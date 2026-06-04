import crypto from "node:crypto";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import {
  execute,
  initDatabase,
  mapBlogRow,
  mapProductRow,
  mapSettingsRow,
  mapUserRow,
  queryAll,
  queryOne,
  withTransaction
} from "./db.js";
import { signAuthToken, verifyAuthToken, TOKEN_COOKIE_NAME, cookieOptions } from "./auth.js";
import {
  getPaystackConfigurationError,
  initializeTransaction,
  isPaystackConfigured,
  verifyTransaction,
  verifyWebhookSignature
} from "./paystack.js";
import {
  getMailerRuntimeInfo,
  sendAccountWelcome,
  sendCustomerOrderConfirmation,
  sendEmailVerification,
  sendNewsletterAdminNotification,
  sendNewsletterWelcome,
  sendOrderNotification
} from "./mailer.js";
import {
  DEFAULT_FEATURE_ITEMS,
  DEFAULT_HERO_PROMISE_ITEMS,
  DEFAULT_PRODUCT_DETAIL_BULLETS,
  DEFAULT_PRODUCTS,
  DEFAULT_SETTINGS
} from "./defaults.js";

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.SITE_URL || "http://localhost:3000";
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PRODUCT_AUDIENCE_VALUES = ["women", "men", "sunglasses", "unisex", "antiblue", "prescrip"];
const PRODUCT_AUDIENCE_SET = new Set(PRODUCT_AUDIENCE_VALUES);
const PRODUCT_AVAILABILITY_VALUES = ["in_stock", "out_of_stock", "preorder"];
const PRODUCT_AVAILABILITY_SET = new Set(PRODUCT_AVAILABILITY_VALUES);
const ACCOUNT_WELCOME_EMAIL_ENABLED = parseBooleanEnv(process.env.ACCOUNT_WELCOME_EMAIL_ENABLED, true);
const CUSTOMER_ORDER_EMAIL_ENABLED = parseBooleanEnv(process.env.CUSTOMER_ORDER_EMAIL_ENABLED, true);
const NEWSLETTER_EMAIL_ENABLED = parseBooleanEnv(process.env.NEWSLETTER_EMAIL_ENABLED, true);
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "").trim();
const googleOAuthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const rateBuckets = new Map();
const PLACEHOLDER_BLOG = {
  id: "style-guide-placeholder",
  title: "How to choose frames that match your mood",
  excerpt: "A simple guide to choosing frame shapes, colors, and finishes that feel natural on your face.",
  content:
    [
      "The right frame should feel like an easy extension of your day. Start with the mood you want to carry: softer translucent frames for daylight, sharper dark silhouettes for definition, and warm tortoise tones when you want something polished but relaxed.",
      "Shape matters too. Rounded lenses can soften strong angles, cat-eye frames add lift and attitude, while oversized square frames create a confident editorial finish. The best choice is usually the one that makes your face feel more awake.",
      "Think about where you will wear them most. A daily pair should be easy to repeat with your wardrobe, while a statement frame can carry color, shine, or detail. If you are between two options, choose the one you keep wanting to try on again."
    ].join("\n\n"),
  image: "/preview/hero-v1-gallery.jpg",
  author: "IfeShadesnMore",
  isPublished: true,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
};

let readyPromise = null;
let storefrontFallbackWarningLogged = false;

function readPositiveIntegerEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export function getSiteUrl() {
  return String(process.env.SITE_URL || process.env.FRONTEND_URL || FRONTEND_URL)
    .trim()
    .replace(/\/+$/, "");
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function productPath(product) {
  const slug = slugify(product?.name || product?.id || "product") || "product";
  return `/products/${slug}--${encodeURIComponent(product.id)}`;
}

export function blogPath(blog) {
  const slug = slugify(blog?.title || blog?.id || "blog") || "blog";
  return `/blog/${slug}--${encodeURIComponent(blog.id)}`;
}

export async function ensureServerReady() {
  if (!readyPromise) {
    readyPromise = initDatabase()
      .then(() => bootstrapAdminIfConfigured())
      .catch((error) => {
        readyPromise = null;
        throw error;
      });
  }
  return withTimeout(
    readyPromise,
    readPositiveIntegerEnv("SERVER_READY_TIMEOUT_MS", 10000),
    "Server database initialization timed out."
  );
}

export async function getStorefrontPayload() {
  try {
    await ensureServerReady();
    const settingsRow = await queryOne("SELECT * FROM settings WHERE id = 1");
    const productsRows = await queryAll("SELECT * FROM products ORDER BY created_at DESC");
    const blogRows = await queryAll("SELECT * FROM blogs WHERE is_published = true ORDER BY created_at DESC");
    const blogs = blogRows.map(mapBlogRow);
    return {
      settings: settingsRow ? mapSettingsRow(settingsRow) : DEFAULT_SETTINGS,
      products: productsRows.map(mapProductRow),
      blogs: blogs.length > 0 ? blogs : [PLACEHOLDER_BLOG]
    };
  } catch (error) {
    if (!storefrontFallbackWarningLogged) {
      storefrontFallbackWarningLogged = true;
      console.warn(
        "Storefront database unavailable; rendering default storefront data.",
        error?.message || error
      );
    }
    return getFallbackStorefrontPayload();
  }
}

export async function getProductBySlugId(slugId) {
  const raw = String(slugId || "");
  const marker = "--";
  const id = raw.includes(marker) ? raw.slice(raw.lastIndexOf(marker) + marker.length) : raw;
  const decodedId = decodeURIComponent(id);
  try {
    await ensureServerReady();
    const row = await queryOne("SELECT * FROM products WHERE id = ?", [decodedId]);
    return row ? mapProductRow(row) : null;
  } catch {
    return DEFAULT_PRODUCTS.find((product) => product.id === decodedId) || null;
  }
}

export async function getBlogBySlugId(slugId) {
  const raw = String(slugId || "");
  const marker = "--";
  const id = raw.includes(marker) ? raw.slice(raw.lastIndexOf(marker) + marker.length) : raw;
  const decodedId = decodeURIComponent(id);
  if (decodedId === PLACEHOLDER_BLOG.id) return PLACEHOLDER_BLOG;
  try {
    await ensureServerReady();
    const row = await queryOne("SELECT * FROM blogs WHERE id = ? AND is_published = true", [decodedId]);
    return row ? mapBlogRow(row) : null;
  } catch {
    return null;
  }
}

export async function getCurrentUserFromFetchRequest(request) {
  const cookies = parseCookies(request.headers.get("cookie") || "");
  const token = cookies[TOKEN_COOKIE_NAME];
  if (!token) return null;
  try {
    await ensureServerReady();
    const payload = verifyAuthToken(token);
    const userRow = await queryOne("SELECT * FROM users WHERE id = ?", [Number(payload.sub)]);
    if (!userRow) return null;
    const user = mapUserRow(userRow);
    const subscriptionRow = user.email
      ? await queryOne("SELECT id FROM subscriptions WHERE lower(email) = lower(?)", [user.email])
      : null;
    return { ...user, isNewsletterSubscribed: Boolean(subscriptionRow) };
  } catch {
    return null;
  }
}

function getFallbackStorefrontPayload() {
  return {
    settings: DEFAULT_SETTINGS,
    products: DEFAULT_PRODUCTS,
    blogs: [PLACEHOLDER_BLOG]
  };
}

export async function handleApiRequest(request, splat = "") {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const pathname = `/api/${String(splat || "").replace(/^\/+/, "")}`.replace(/\/+$/, "") || "/api";

  try {
    if (method === "OPTIONS") return new Response(null, { status: 204 });
    if (method === "GET" && pathname === "/api/health") return json({ ok: true });
    if (method === "GET" && pathname === "/api/storefront") return json(await getStorefrontPayload());
    if (method === "GET" && pathname === "/api/auth/me") {
      return json({ user: await getCurrentUserFromFetchRequest(request) });
    }
    await ensureServerReady();
    if (method === "POST" && pathname === "/api/auth/register") return register(request);
    if (method === "POST" && pathname === "/api/auth/verify-email") return verifyEmail(request);
    if (method === "POST" && pathname === "/api/auth/resend-verification") return resendVerification(request);
    if (method === "POST" && pathname === "/api/auth/login") return login(request);
    if (method === "POST" && pathname === "/api/auth/google") return googleLogin(request);
    if (method === "POST" && pathname === "/api/auth/logout") return logout();
    if (method === "PATCH" && pathname === "/api/auth/profile") return updateProfile(request);
    if (method === "PATCH" && pathname === "/api/auth/password") return updatePassword(request);
    if (method === "GET" && pathname === "/api/orders/my") return getMyOrders(request);
    if (method === "GET" && pathname === "/api/orders") return getAllOrders(request);
    if (method === "POST" && pathname === "/api/orders") return createAdminOrder(request);
    if (method === "PATCH" && match(pathname, /^\/api\/orders\/([^/]+)\/status$/)) {
      return updateOrderStatus(request, decodeURIComponent(match(pathname, /^\/api\/orders\/([^/]+)\/status$/)[1]));
    }
    if (method === "POST" && pathname === "/api/checkout/initialize") return initializeCheckout(request);
    if (method === "GET" && pathname === "/api/checkout/verify") {
      return verifyCheckout(request, String(url.searchParams.get("reference") || ""));
    }
    if (method === "POST" && pathname === "/api/paystack/webhook") return paystackWebhook(request);
    if (method === "PATCH" && pathname === "/api/settings") return updateSettings(request);
    if (method === "POST" && pathname === "/api/products") return createProduct(request);
    if (method === "PUT" && match(pathname, /^\/api\/products\/([^/]+)$/)) {
      return updateProduct(request, decodeURIComponent(match(pathname, /^\/api\/products\/([^/]+)$/)[1]));
    }
    if (method === "DELETE" && match(pathname, /^\/api\/products\/([^/]+)$/)) {
      return deleteProduct(request, decodeURIComponent(match(pathname, /^\/api\/products\/([^/]+)$/)[1]));
    }
    if (method === "GET" && pathname === "/api/blogs") return getBlogs(request);
    if (method === "POST" && pathname === "/api/blogs") return createBlog(request);
    if (method === "PUT" && match(pathname, /^\/api\/blogs\/([^/]+)$/)) {
      return updateBlog(request, decodeURIComponent(match(pathname, /^\/api\/blogs\/([^/]+)$/)[1]));
    }
    if (method === "DELETE" && match(pathname, /^\/api\/blogs\/([^/]+)$/)) {
      return deleteBlog(request, decodeURIComponent(match(pathname, /^\/api\/blogs\/([^/]+)$/)[1]));
    }
    if (method === "GET" && pathname === "/api/admin/bootstrap-state") return adminBootstrapState();
    if (method === "GET" && pathname === "/api/admin/customers") return getCustomers(request);
    if (method === "POST" && pathname === "/api/admin/customers") return createAdminCustomer(request);
    if (method === "DELETE" && match(pathname, /^\/api\/admin\/customers\/([^/]+)$/)) {
      return deleteCustomer(request, decodeURIComponent(match(pathname, /^\/api\/admin\/customers\/([^/]+)$/)[1]));
    }
    if (method === "POST" && pathname === "/api/subscriptions") return createSubscription(request);
    if (method === "GET" && pathname === "/api/subscriptions") return getSubscriptions(request);
    if (method === "POST" && pathname === "/api/uploads/image") return uploadImage(request);
    return json({ error: "Not found." }, 404);
  } catch (error) {
    return json({ error: error?.message || "Unexpected server error." }, 500);
  }
}

function match(pathname, regex) {
  return pathname.match(regex);
}

function json(payload, status = 200, headers = new Headers()) {
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(payload), { status, headers });
}

async function readJson(request) {
  return request.json().catch(() => ({}));
}

function parseCookies(header) {
  return Object.fromEntries(
    String(header || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge != null) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`);
  return parts.join("; ");
}

function authHeaders(user = null, clear = false) {
  const headers = new Headers();
  if (clear) {
    const { maxAge, ...rest } = cookieOptions();
    void maxAge;
    headers.append("Set-Cookie", serializeCookie(TOKEN_COOKIE_NAME, "", { ...rest, maxAge: 0 }));
    return headers;
  }
  headers.append("Set-Cookie", serializeCookie(TOKEN_COOKIE_NAME, signAuthToken(user), cookieOptions()));
  return headers;
}

function clientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function checkRateLimit(request, key, max = 30, windowMs = 15 * 60 * 1000) {
  const bucketKey = `${key}:${clientIp(request)}`;
  const now = Date.now();
  const bucket = rateBuckets.get(bucketKey) || { count: 0, resetAt: now + windowMs };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateBuckets.set(bucketKey, bucket);
  return bucket.count <= max;
}

async function requireUser(request, role = "") {
  const user = await getCurrentUserFromFetchRequest(request);
  if (!user) return { response: json({ error: "Authentication required." }, 401) };
  if (role && user.role !== role) return { response: json({ error: "Admin access required." }, 403) };
  return { user };
}

function createOrderId() {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const nonce = Math.floor(Math.random() * 9000 + 1000);
  return `IFE-${timestamp}-${nonce}`;
}

function createPaymentReference() {
  return `IFE_REF_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

function hashVerificationToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken || "")).digest("hex");
}

async function createVerificationToken(userId) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS).toISOString();
  await execute("DELETE FROM email_verification_tokens WHERE user_id = ? AND consumed_at IS NULL", [userId]);
  await execute(
    "INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    [userId, tokenHash, expiresAt]
  );
  return {
    rawToken,
    verificationUrl: `${FRONTEND_URL}/account/verify-email?token=${encodeURIComponent(rawToken)}`,
    expiresAt
  };
}

async function sendVerificationEmailSafe({ toEmail, fullName, verificationUrl }) {
  try {
    return await sendEmailVerification({ toEmail, fullName, verificationUrl });
  } catch (error) {
    console.error("Could not send verification email:", {
      message: error?.message || "",
      mailer: getMailerRuntimeInfo()
    });
    return { delivered: false };
  }
}

async function sendAccountWelcomeSafe({ toEmail, fullName }) {
  if (!ACCOUNT_WELCOME_EMAIL_ENABLED) return { delivered: false, skipped: "disabled" };
  try {
    return await sendAccountWelcome({ toEmail, fullName });
  } catch (error) {
    console.error("Could not send account welcome email:", {
      message: error?.message || "",
      mailer: getMailerRuntimeInfo()
    });
    return { delivered: false };
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function parseBooleanEnv(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeAudienceValue(value) {
  const source = String(value || "").trim().toLowerCase();
  if (!source) return "unisex";
  if (PRODUCT_AUDIENCE_SET.has(source)) return source;
  const compact = source.replace(/[^a-z]/g, "");
  if (compact.includes("women") || compact.includes("woman") || compact.includes("female") || compact.includes("lady")) return "women";
  if (compact === "men" || compact === "man" || compact.includes("male") || compact.includes("gent")) return "men";
  if (compact.includes("sunglass") || compact.includes("shades")) return "sunglasses";
  if (compact.includes("antiblue") || compact.includes("bluelight") || compact.includes("antiglare")) return "antiblue";
  if (compact.includes("prescrip") || compact === "rx") return "prescrip";
  return "unisex";
}

function normalizeAudienceList(rawValue) {
  const source = Array.isArray(rawValue) ? rawValue : String(rawValue || "").split(",");
  const normalized = source.map(normalizeAudienceValue).filter((value) => PRODUCT_AUDIENCE_SET.has(value));
  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique : ["unisex"];
}

function normalizeProductAvailability(value) {
  const source = String(value || "").trim().toLowerCase();
  if (PRODUCT_AVAILABILITY_SET.has(source)) return source;
  const compact = source.replace(/[^a-z]/g, "");
  if (compact === "outofstock" || compact === "soldout" || compact === "unavailable") return "out_of_stock";
  if (compact === "preorder" || compact === "preorderonly") return "preorder";
  return "in_stock";
}

function normalizePreorderNote(value) {
  return String(value || "").trim().slice(0, 180);
}

function normalizeDetailBullets(rawValue) {
  const normalized = (Array.isArray(rawValue) ? rawValue : [])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  return normalized.length > 0 ? normalized : DEFAULT_PRODUCT_DETAIL_BULLETS;
}

async function bootstrapAdminIfConfigured() {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const adminPassword = String(process.env.ADMIN_PASSWORD || "").trim();
  if (!adminEmail || !adminPassword) return;
  const existing = await queryOne("SELECT id FROM users WHERE email = ?", [adminEmail]);
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  if (existing) {
    await execute(
      "UPDATE users SET password_hash = ?, role = 'admin', is_email_verified = true, updated_at = datetime('now') WHERE id = ?",
      [passwordHash, existing.id]
    );
    return;
  }
  await execute(
    "INSERT INTO users (email, password_hash, role, is_email_verified, full_name) VALUES (?, ?, 'admin', true, 'Administrator')",
    [adminEmail, passwordHash]
  );
}

const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    firstName: z.string().max(60).optional().default(""),
    lastName: z.string().max(60).optional().default(""),
    fullName: z.string().max(120).optional().default(""),
    phone: z.string().trim().min(1).max(40),
    address: z.string().max(300).optional().default(""),
    city: z.string().max(120).optional().default("")
  })
  .refine(
    (value) =>
      (Boolean(`${value.firstName || ""}`.trim()) && Boolean(`${value.lastName || ""}`.trim())) ||
      Boolean(`${value.fullName || ""}`.trim()),
    { message: "First and last name are required.", path: ["firstName"] }
  );
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const googleLoginSchema = z.object({ credential: z.string().min(20).max(5000) });
const verifyEmailSchema = z.object({ token: z.string().min(20).max(500) });
const resendVerificationSchema = z.object({ email: z.string().email() });
const profileSchema = z.object({
  fullName: z.string().min(1).max(120),
  phone: z.string().max(40),
  address: z.string().max(300),
  city: z.string().max(120)
});
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128)
});
const bulletItemSchema = z.object({
  type: z.enum(["shipping", "arrivals", "quality", "returns"]),
  title: z.string().min(1).max(80),
  description: z.string().max(120).optional().default("")
});
const settingsSchema = z.object({
  brandName: z.string().min(1).max(120),
  brandTagline: z.string().min(1).max(80),
  heroKicker: z.string().max(80).optional().default(""),
  heroTitle: z.string().min(1).max(180),
  heroSubtitle: z.string().min(1).max(240),
  heroButtonLabel: z.string().min(1).max(80),
  heroImage: z.string().min(1).max(5_000_000),
  heroPromiseItems: z.array(bulletItemSchema).min(1).max(6).optional().default(DEFAULT_HERO_PROMISE_ITEMS),
  featureItems: z.array(bulletItemSchema).min(1).max(6).optional().default(DEFAULT_FEATURE_ITEMS)
});
const productSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(180),
  price: z.coerce.number().int().nonnegative(),
  section: z.enum(["category", "bestseller"]),
  audience: z.string().max(120).optional().default(""),
  audiences: z.array(z.string().max(40)).optional().default([]),
  ctaLabel: z.string().max(80).optional().default(""),
  description: z.string().max(400).optional().default(""),
  detailBullets: z.array(z.string().max(120)).max(8).optional().default([]),
  availability: z.enum(PRODUCT_AVAILABILITY_VALUES).optional().default("in_stock"),
  preorderNote: z.string().max(180).optional().default(""),
  variant: z.string().max(40).optional().default("round"),
  image: z.string().max(5_000_000).optional().default("")
});
const blogSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  title: z.string().min(1).max(180),
  excerpt: z.string().max(260).optional().default(""),
  content: z.string().min(1).max(8000),
  image: z.string().max(5_000_000).optional().default(""),
  author: z.string().max(120).optional().default(""),
  isPublished: z.boolean().optional().default(true)
});
const checkoutSchema = z.object({
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(99) })).min(1),
  paymentMethod: z.enum(["card", "transfer"]),
  customer: z
    .object({
      firstName: z.string().max(60).optional().default(""),
      lastName: z.string().max(60).optional().default(""),
      fullName: z.string().max(120).optional().default(""),
      email: z.string().email().optional().or(z.literal("")).default(""),
      phone: z.string().max(40).optional().default(""),
      address: z.string().min(1).max(300),
      city: z.string().min(1).max(120)
    })
    .refine((value) => Boolean(`${value.phone || ""}`.trim()) || Boolean(`${value.email || ""}`.trim()), {
      message: "Phone or email is required.",
      path: ["phone"]
    })
    .refine(
      (value) =>
        (Boolean(`${value.firstName || ""}`.trim()) && Boolean(`${value.lastName || ""}`.trim())) ||
        Boolean(`${value.fullName || ""}`.trim()),
      { message: "First and last name are required.", path: ["firstName"] }
    )
});
const orderStatusSchema = z.object({ orderStatus: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]) });
const adminCustomerSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().min(1).max(40),
  address: z.string().max(300).optional().default(""),
  city: z.string().max(120).optional().default("")
});
const adminOrderSchema = z.object({
  customerId: z.coerce.number().int().positive().optional(),
  fullName: z.string().max(120).optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  phone: z.string().min(1).max(40),
  address: z.string().min(1).max(300),
  city: z.string().min(1).max(120),
  paymentMethod: z.enum(["card", "transfer"]).optional().default("transfer"),
  paymentStatus: z.enum(["pending", "paid", "failed", "cancelled"]).optional().default("pending"),
  orderStatus: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]).optional().default("pending"),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(99) })).min(1)
}).refine((value) => Boolean(value.customerId) || Boolean(normalizeEmail(value.email)), {
  message: "Select a customer or enter an email address.",
  path: ["email"]
}).refine((value) => Boolean(value.customerId) || Boolean(String(value.fullName || "").trim()), {
  message: "Customer name is required.",
  path: ["fullName"]
});
const subscriptionSchema = z.object({
  email: z.string().email(),
  source: z.string().max(80).optional().default("footer")
});

async function register(request) {
  if (!checkRateLimit(request, "auth")) return json({ error: "Too many requests. Please try again later." }, 429);
  const parsed = registerSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid signup payload." }, 400);
  const payload = parsed.data;
  const email = normalizeEmail(payload.email);
  const existing = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) return json({ error: "An account with this email already exists." }, 409);
  const passwordHash = await bcrypt.hash(payload.password, 12);
  const fullName = payload.fullName.trim() || `${payload.firstName || ""} ${payload.lastName || ""}`.trim();
  const result = await execute(
    "INSERT INTO users (email, password_hash, full_name, phone, address, city, is_email_verified) VALUES (?, ?, ?, ?, ?, ?, false)",
    [email, passwordHash, fullName, payload.phone.trim(), payload.address.trim(), payload.city.trim()]
  );
  const verification = await createVerificationToken(result.lastInsertRowid);
  await sendVerificationEmailSafe({ toEmail: email, fullName, verificationUrl: verification.verificationUrl });
  return json({ ok: true, message: "Signup successful. Please verify your email, then login." }, 201);
}

async function verifyEmail(request) {
  if (!checkRateLimit(request, "auth")) return json({ error: "Too many requests. Please try again later." }, 429);
  const parsed = verifyEmailSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid verification token." }, 400);
  const tokenHash = hashVerificationToken(parsed.data.token);
  const row = await queryOne(
    "SELECT * FROM email_verification_tokens WHERE token_hash = ? AND consumed_at IS NULL",
    [tokenHash]
  );
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return json({ error: "Verification link is invalid or expired." }, 400);
  await execute("UPDATE users SET is_email_verified = true, updated_at = datetime('now') WHERE id = ?", [row.user_id]);
  await execute("UPDATE email_verification_tokens SET consumed_at = datetime('now') WHERE id = ?", [row.id]);
  const userRow = await queryOne("SELECT * FROM users WHERE id = ?", [row.user_id]);
  const user = mapUserRow(userRow);
  await sendAccountWelcomeSafe({ toEmail: user.email, fullName: user.fullName });
  return json({ user, message: "Email verified successfully." }, 200, authHeaders(user));
}

async function resendVerification(request) {
  if (!checkRateLimit(request, "auth")) return json({ error: "Too many requests. Please try again later." }, 429);
  const parsed = resendVerificationSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Enter a valid email address." }, 400);
  const email = normalizeEmail(parsed.data.email);
  const userRow = await queryOne("SELECT * FROM users WHERE email = ?", [email]);
  if (!userRow) return json({ ok: true, message: "If an account exists, a verification email has been sent." });
  if (Boolean(userRow.is_email_verified)) return json({ ok: true, message: "This email is already verified. You can login." });
  const verification = await createVerificationToken(userRow.id);
  await sendVerificationEmailSafe({ toEmail: email, fullName: userRow.full_name || "", verificationUrl: verification.verificationUrl });
  return json({ ok: true, message: "Verification email sent. Please check your inbox and spam folder." });
}

async function login(request) {
  if (!checkRateLimit(request, "auth")) return json({ error: "Too many requests. Please try again later." }, 429);
  const parsed = loginSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid login payload." }, 400);
  const userRow = await queryOne("SELECT * FROM users WHERE email = ?", [normalizeEmail(parsed.data.email)]);
  if (!userRow || !(await bcrypt.compare(parsed.data.password, userRow.password_hash))) {
    return json({ error: "Invalid email or password." }, 401);
  }
  if (!Boolean(userRow.is_email_verified)) {
    return json({ error: "Please verify your email before logging in.", requiresEmailVerification: true, email: userRow.email }, 403);
  }
  const user = mapUserRow(userRow);
  return json({ user }, 200, authHeaders(user));
}

async function googleLogin(request) {
  if (!checkRateLimit(request, "auth")) return json({ error: "Too many requests. Please try again later." }, 429);
  if (!googleOAuthClient || !GOOGLE_CLIENT_ID) {
    return json({ error: "Google login is not configured." }, 503);
  }

  const parsed = googleLoginSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid Google login payload." }, 400);

  let payload = null;
  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: parsed.data.credential,
      audience: GOOGLE_CLIENT_ID
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.error("Could not verify Google credential:", { message: error?.message || "" });
    return json({ error: "Could not verify Google login." }, 401);
  }

  const email = normalizeEmail(payload?.email);
  const googleSub = String(payload?.sub || "").trim();
  const emailVerified = payload?.email_verified === true || payload?.email_verified === "true";
  if (!email || !googleSub || !emailVerified) {
    return json({ error: "Google account email is not verified." }, 401);
  }

  const fullName = String(payload?.name || `${payload?.given_name || ""} ${payload?.family_name || ""}`)
    .trim()
    .slice(0, 180);

  const authResult = await withTransaction(async (tx) => {
    const googleUser = await tx.queryOne("SELECT * FROM users WHERE google_sub = ?", [googleSub]);
    const emailUser = googleUser || (await tx.queryOne("SELECT * FROM users WHERE email = ?", [email]));

    if (emailUser) {
      if (emailUser.google_sub && emailUser.google_sub !== googleSub) {
        throw new Error("This email is already linked to another Google account.");
      }

      await tx.execute(
        `
          UPDATE users
          SET google_sub = ?, auth_provider = ?, is_email_verified = true,
              full_name = CASE WHEN COALESCE(full_name, '') = '' THEN ? ELSE full_name END,
              updated_at = datetime('now')
          WHERE id = ?
        `,
        [googleSub, emailUser.auth_provider === "password" ? "password,google" : "google", fullName, emailUser.id]
      );
      return { user: mapUserRow(await tx.queryOne("SELECT * FROM users WHERE id = ?", [emailUser.id])), isNew: false };
    }

    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
    await tx.execute(
      `
        INSERT INTO users (email, password_hash, full_name, phone, address, city, is_email_verified, google_sub, auth_provider)
        VALUES (?, ?, ?, '', '', '', true, ?, 'google')
      `,
      [email, passwordHash, fullName, googleSub]
    );
    return { user: mapUserRow(await tx.queryOne("SELECT * FROM users WHERE email = ?", [email])), isNew: true };
  }).catch((error) => {
    if (error?.message === "This email is already linked to another Google account.") return { error: error.message };
    throw error;
  });

  if (authResult?.error) return json({ error: authResult.error }, 409);
  if (authResult?.isNew) {
    await sendAccountWelcomeSafe({ toEmail: authResult.user.email, fullName: authResult.user.fullName });
  }
  return json({ user: authResult.user }, 200, authHeaders(authResult.user));
}

function logout() {
  return json({ ok: true }, 200, authHeaders(null, true));
}

async function updateProfile(request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const parsed = profileSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid profile payload." }, 400);
  const payload = parsed.data;
  await execute(
    "UPDATE users SET full_name = ?, phone = ?, address = ?, city = ?, updated_at = datetime('now') WHERE id = ?",
    [payload.fullName.trim(), payload.phone.trim(), payload.address.trim(), payload.city.trim(), auth.user.id]
  );
  const userRow = await queryOne("SELECT * FROM users WHERE id = ?", [auth.user.id]);
  return json({ user: mapUserRow(userRow) });
}

async function updatePassword(request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const parsed = passwordChangeSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid password payload." }, 400);
  const userRow = await queryOne("SELECT * FROM users WHERE id = ?", [auth.user.id]);
  const currentPasswordMatches = await bcrypt.compare(parsed.data.currentPassword, userRow.password_hash);
  if (!currentPasswordMatches) return json({ error: "Current password is incorrect." }, 401);
  if (await bcrypt.compare(parsed.data.newPassword, userRow.password_hash)) {
    return json({ error: "New password must be different from current password." }, 400);
  }
  await execute("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", [
    await bcrypt.hash(parsed.data.newPassword, 12),
    auth.user.id
  ]);
  return json({ ok: true, message: "Password updated successfully." });
}

async function getOrderItems(orderId) {
  const rows = await queryAll(
    "SELECT id, product_id, name, availability, preorder_note, unit_price, quantity, line_total FROM order_items WHERE order_id = ? ORDER BY id ASC",
    [orderId]
  );
  return rows.map((item) => ({
    id: item.id,
    productId: item.product_id,
    name: item.name,
    availability: normalizeProductAvailability(item.availability),
    preorderNote: normalizeProductAvailability(item.availability) === "preorder" ? normalizePreorderNote(item.preorder_note) : "",
    unitPrice: Number(item.unit_price) || 0,
    quantity: Number(item.quantity) || 0,
    lineTotal: Number(item.line_total) || 0
  }));
}

function mapOrderRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    paymentChannel: row.payment_channel || "",
    paymentStatus: row.payment_status,
    orderStatus: row.order_status || "pending",
    adminNotifiedAt: row.admin_notified_at || null,
    customerNotifiedAt: row.customer_notified_at || null,
    subtotal: Number(row.subtotal) || 0,
    currency: row.currency || "NGN",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function withOrderItems(rows) {
  return Promise.all(rows.map(async (row) => ({ ...mapOrderRow(row), items: await getOrderItems(row.id) })));
}

async function getMyOrders(request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const rows = await queryAll("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", [auth.user.id]);
  return json({ orders: await withOrderItems(rows) });
}

async function getAllOrders(request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const rows = await queryAll("SELECT * FROM orders ORDER BY created_at DESC");
  return json({ orders: await withOrderItems(rows) });
}

async function createAdminOrder(request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const parsed = adminOrderSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid order payload." }, 400);
  const payload = parsed.data;

  let customerRow = null;
  if (payload.customerId) {
    customerRow = await queryOne("SELECT * FROM users WHERE id = ? AND role = 'customer'", [payload.customerId]);
    if (!customerRow) return json({ error: "Customer not found." }, 404);
  } else {
    const email = normalizeEmail(payload.email);
    customerRow = await queryOne("SELECT * FROM users WHERE email = ? AND role = 'customer'", [email]);
    if (!customerRow) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 12);
      await execute(
        "INSERT INTO users (email, password_hash, role, is_email_verified, full_name, phone, address, city) VALUES (?, ?, 'customer', true, ?, ?, ?, ?)",
        [email, passwordHash, payload.fullName.trim(), payload.phone.trim(), payload.address.trim(), payload.city.trim()]
      );
      customerRow = await queryOne("SELECT * FROM users WHERE email = ? AND role = 'customer'", [email]);
    }
  }

  const uniqueIds = [...new Set(payload.items.map((item) => item.productId))];
  const productsRows = await queryAll(`SELECT * FROM products WHERE id IN (${uniqueIds.map(() => "?").join(",")})`, uniqueIds);
  const productMap = new Map(productsRows.map(mapProductRow).map((product) => [product.id, product]));
  const validItems = payload.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) return null;
    const availability = normalizeProductAvailability(product.availability);
    const lineTotal = product.price * item.quantity;
    return {
      productId: product.id,
      name: product.name,
      availability,
      preorderNote: availability === "preorder" ? normalizePreorderNote(product.preorderNote) : "",
      unitPrice: product.price,
      quantity: item.quantity,
      lineTotal
    };
  });
  if (validItems.some((item) => item === null)) return json({ error: "One or more products are invalid." }, 400);
  const subtotal = validItems.reduce((sum, item) => sum + item.lineTotal, 0);
  if (subtotal <= 0) return json({ error: "Invalid order amount." }, 400);

  const orderId = createOrderId();
  const reference = createPaymentReference();
  const fullName = payload.customerId
    ? String(customerRow.full_name || payload.fullName || "").trim() || "Customer"
    : payload.fullName.trim();
  const email = normalizeEmail(payload.customerId ? customerRow.email : payload.email);

  await withTransaction(async (tx) => {
    await tx.execute(
      "INSERT INTO orders (id, user_id, email, full_name, phone, address, city, payment_method, payment_reference, payment_status, order_status, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        orderId,
        customerRow.id,
        email,
        fullName,
        payload.phone.trim(),
        payload.address.trim(),
        payload.city.trim(),
        payload.paymentMethod,
        reference,
        payload.paymentStatus,
        payload.orderStatus,
        subtotal
      ]
    );
    for (const item of validItems) {
      await tx.execute(
        "INSERT INTO order_items (order_id, product_id, name, availability, preorder_note, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [orderId, item.productId, item.name, item.availability, item.preorderNote, item.unitPrice, item.quantity, item.lineTotal]
      );
    }
  });

  await execute("UPDATE users SET full_name = ?, phone = ?, address = ?, city = ?, updated_at = datetime('now') WHERE id = ?", [
    fullName,
    payload.phone.trim(),
    payload.address.trim(),
    payload.city.trim(),
    customerRow.id
  ]);
  await sendOrderAlertSafe({ orderId });
  await sendCustomerOrderAlertSafe({ orderId });

  const refreshed = await queryOne("SELECT * FROM orders WHERE id = ?", [orderId]);
  return json({ order: { ...mapOrderRow(refreshed), items: await getOrderItems(orderId) } }, 201);
}

async function updateOrderStatus(request, id) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const parsed = orderStatusSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid order status payload." }, 400);
  const order = await queryOne("SELECT * FROM orders WHERE id = ?", [id]);
  if (!order) return json({ error: "Order not found." }, 404);
  await execute("UPDATE orders SET order_status = ?, updated_at = datetime('now') WHERE id = ?", [parsed.data.orderStatus, id]);
  const refreshed = await queryOne("SELECT * FROM orders WHERE id = ?", [id]);
  return json({ order: { ...mapOrderRow(refreshed), items: await getOrderItems(id) } });
}

async function initializeCheckout(request) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const parsed = checkoutSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid checkout payload." }, 400);
  if (!isPaystackConfigured()) {
    return json({ error: getPaystackConfigurationError() || "Payment provider is not configured yet." }, 503);
  }
  const payload = parsed.data;
  const uniqueIds = [...new Set(payload.items.map((item) => item.productId))];
  const productsRows = await queryAll(`SELECT * FROM products WHERE id IN (${uniqueIds.map(() => "?").join(",")})`, uniqueIds);
  const productMap = new Map(productsRows.map(mapProductRow).map((product) => [product.id, product]));
  const unavailableProducts = payload.items
    .map((item) => productMap.get(item.productId))
    .filter((product) => product && product.availability === "out_of_stock")
    .map((product) => product.name);
  if (unavailableProducts.length > 0) {
    return json({ error: `Out-of-stock item(s) detected: ${[...new Set(unavailableProducts)].join(", ")}. Please update your cart.` }, 409);
  }
  const computedItems = payload.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) return null;
    const availability = normalizeProductAvailability(product.availability);
    const lineTotal = product.price * item.quantity;
    return {
      productId: product.id,
      name: product.name,
      availability,
      preorderNote: availability === "preorder" ? normalizePreorderNote(product.preorderNote) : "",
      unitPrice: product.price,
      quantity: item.quantity,
      lineTotal
    };
  });
  if (computedItems.some((item) => item === null)) return json({ error: "One or more products are invalid." }, 400);
  const validItems = computedItems.filter(Boolean);
  const subtotal = validItems.reduce((sum, item) => sum + item.lineTotal, 0);
  if (subtotal <= 0) return json({ error: "Invalid checkout amount." }, 400);
  const orderId = createOrderId();
  const reference = createPaymentReference();
  const customer = payload.customer;
  const customerFullName = `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.fullName.trim();
  const customerEmail = normalizeEmail(customer.email || "");
  const customerPhone = String(customer.phone || "").trim();
  await withTransaction(async (tx) => {
    await tx.execute(
      "INSERT INTO orders (id, user_id, email, full_name, phone, address, city, payment_method, payment_reference, payment_status, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
      [orderId, auth.user.id, customerEmail || auth.user.email, customerFullName, customerPhone, customer.address.trim(), customer.city.trim(), payload.paymentMethod, reference, subtotal]
    );
    for (const item of validItems) {
      await tx.execute(
        "INSERT INTO order_items (order_id, product_id, name, availability, preorder_note, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [orderId, item.productId, item.name, item.availability, item.preorderNote, item.unitPrice, item.quantity, item.lineTotal]
      );
    }
  });
  try {
    const checkout = await initializeTransaction({
      email: customerEmail || auth.user.email,
      amountInKobo: subtotal * 100,
      reference,
      callbackUrl: `${FRONTEND_URL}/payment/callback`,
      channels: payload.paymentMethod === "transfer" ? ["bank_transfer", "bank"] : ["card"],
      metadata: { orderId, userId: auth.user.id }
    });
    await execute("UPDATE users SET full_name = ?, phone = ?, address = ?, city = ?, updated_at = datetime('now') WHERE id = ?", [
      customerFullName,
      customerPhone,
      customer.address.trim(),
      customer.city.trim(),
      auth.user.id
    ]);
    return json({ orderId, reference, authorizationUrl: checkout.authorization_url, accessCode: checkout.access_code });
  } catch (error) {
    await execute("UPDATE orders SET payment_status = 'failed', updated_at = datetime('now') WHERE id = ?", [orderId]);
    return json({ error: error.message || "Could not initialize payment." }, 502);
  }
}

async function verifyCheckout(request, reference) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  if (!reference) return json({ error: "Payment reference is required." }, 400);
  const orderRow = await queryOne("SELECT * FROM orders WHERE payment_reference = ? AND user_id = ?", [reference, auth.user.id]);
  if (!orderRow) return json({ error: "Order not found for this account." }, 404);
  try {
    const payment = await verifyTransaction(reference);
    const paystackStatus = String(payment.status || "").toLowerCase();
    const isPaid = paystackStatus === "success" && Number(payment.amount || 0) === Number(orderRow.subtotal || 0) * 100;
    await execute("UPDATE orders SET payment_status = ?, payment_channel = ?, updated_at = datetime('now') WHERE id = ?", [
      isPaid ? "paid" : "failed",
      payment.channel || "",
      orderRow.id
    ]);
    if (isPaid) {
      await sendOrderAlertSafe({ orderId: orderRow.id });
      await sendCustomerOrderAlertSafe({ orderId: orderRow.id });
    }
    const refreshed = await queryOne("SELECT * FROM orders WHERE id = ?", [orderRow.id]);
    return json({
      order: { ...mapOrderRow(refreshed), items: await getOrderItems(refreshed.id) },
      payment: { status: isPaid ? "paid" : "failed", gatewayStatus: paystackStatus, reference: payment.reference || reference, channel: payment.channel || "" }
    });
  } catch (error) {
    return json({ error: error.message || "Could not verify payment." }, 502);
  }
}

async function paystackWebhook(request) {
  const raw = Buffer.from(await request.arrayBuffer());
  const verification = verifyWebhookSignature(raw, request.headers.get("x-paystack-signature"));
  if (!verification.ok) {
    if (verification.reason === "missing_signature" || verification.reason === "invalid_signature") return new Response(null, { status: 401 });
    return new Response(null, { status: 204 });
  }
  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (event?.event === "charge.success") {
    const reference = event?.data?.reference;
    const amountKobo = Number(event?.data?.amount || 0);
    if (reference) {
      const order = await queryOne("SELECT id, subtotal FROM orders WHERE payment_reference = ?", [reference]);
      if (order && amountKobo === Number(order.subtotal || 0) * 100) {
        await execute(
          "UPDATE orders SET payment_status = 'paid', payment_channel = ?, order_status = CASE WHEN order_status = 'pending' THEN 'processing' ELSE order_status END, updated_at = datetime('now') WHERE id = ?",
          [event?.data?.channel || "", order.id]
        );
        await sendOrderAlertSafe({ orderId: order.id });
        await sendCustomerOrderAlertSafe({ orderId: order.id });
      }
    }
  }
  return json({ ok: true });
}

async function updateSettings(request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const parsed = settingsSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid settings payload." }, 400);
  const payload = parsed.data;
  await execute(
    "UPDATE settings SET brand_name = ?, brand_tagline = ?, hero_kicker = ?, hero_title = ?, hero_subtitle = ?, hero_button_label = ?, hero_image = ?, hero_promise_items = ?, feature_items = ?, updated_at = datetime('now') WHERE id = 1",
    [
      payload.brandName.trim(),
      payload.brandTagline.trim(),
      payload.heroKicker.trim(),
      payload.heroTitle.trim(),
      payload.heroSubtitle.trim(),
      payload.heroButtonLabel.trim(),
      payload.heroImage.trim(),
      JSON.stringify(payload.heroPromiseItems || DEFAULT_HERO_PROMISE_ITEMS),
      JSON.stringify(payload.featureItems || DEFAULT_FEATURE_ITEMS)
    ]
  );
  const row = await queryOne("SELECT * FROM settings WHERE id = 1");
  return json({ settings: mapSettingsRow(row) });
}

async function createProduct(request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const parsed = productSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid product payload." }, 400);
  const payload = parsed.data;
  const id = payload.id || crypto.randomUUID();
  const product = normalizeProductPayload(payload);
  await execute(
    "INSERT INTO products (id, name, price, section, audience, availability, preorder_note, cta_label, description, detail_bullets, variant, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, product.name, product.price, product.section, product.audience, product.availability, product.preorderNote, product.ctaLabel, product.description, product.detailBullets, product.variant, product.image]
  );
  const row = await queryOne("SELECT * FROM products WHERE id = ?", [id]);
  return json({ product: mapProductRow(row) }, 201);
}

async function updateProduct(request, id) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const parsed = productSchema.safeParse({ ...(await readJson(request)), id });
  if (!parsed.success) return json({ error: "Invalid product payload." }, 400);
  const existing = await queryOne("SELECT id FROM products WHERE id = ?", [id]);
  if (!existing) return json({ error: "Product not found." }, 404);
  const product = normalizeProductPayload(parsed.data);
  await execute(
    "UPDATE products SET name = ?, price = ?, section = ?, audience = ?, availability = ?, preorder_note = ?, cta_label = ?, description = ?, detail_bullets = ?, variant = ?, image = ?, updated_at = datetime('now') WHERE id = ?",
    [product.name, product.price, product.section, product.audience, product.availability, product.preorderNote, product.ctaLabel, product.description, product.detailBullets, product.variant, product.image, id]
  );
  const row = await queryOne("SELECT * FROM products WHERE id = ?", [id]);
  return json({ product: mapProductRow(row) });
}

function normalizeProductPayload(payload) {
  const audienceList = normalizeAudienceList(Array.isArray(payload.audiences) && payload.audiences.length > 0 ? payload.audiences : payload.audience);
  const availability = normalizeProductAvailability(payload.availability);
  return {
    name: payload.name.trim(),
    price: payload.price,
    section: payload.section,
    audience: audienceList.join(","),
    availability,
    preorderNote: availability === "preorder" ? normalizePreorderNote(payload.preorderNote) : "",
    ctaLabel: payload.ctaLabel.trim(),
    description: payload.description.trim(),
    detailBullets: JSON.stringify(normalizeDetailBullets(payload.detailBullets)),
    variant: payload.variant.trim() || "round",
    image: payload.image.trim()
  };
}

async function deleteProduct(request, id) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const existing = await queryOne("SELECT id FROM products WHERE id = ?", [id]);
  if (!existing) return json({ error: "Product not found." }, 404);
  await execute("DELETE FROM products WHERE id = ?", [id]);
  return json({ ok: true });
}

async function getBlogs(request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const rows = await queryAll("SELECT * FROM blogs ORDER BY created_at DESC");
  return json({ blogs: rows.map(mapBlogRow) });
}

async function createBlog(request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const parsed = blogSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid blog payload." }, 400);
  const payload = normalizeBlogPayload(parsed.data);
  const id = parsed.data.id || crypto.randomUUID();
  await execute(
    "INSERT INTO blogs (id, title, excerpt, content, image, author, is_published) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, payload.title, payload.excerpt, payload.content, payload.image, payload.author, payload.isPublished]
  );
  const row = await queryOne("SELECT * FROM blogs WHERE id = ?", [id]);
  return json({ blog: mapBlogRow(row) }, 201);
}

async function updateBlog(request, id) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const parsed = blogSchema.safeParse({ ...(await readJson(request)), id });
  if (!parsed.success) return json({ error: "Invalid blog payload." }, 400);
  const existing = await queryOne("SELECT id FROM blogs WHERE id = ?", [id]);
  if (!existing) return json({ error: "Blog post not found." }, 404);
  const payload = normalizeBlogPayload(parsed.data);
  await execute(
    "UPDATE blogs SET title = ?, excerpt = ?, content = ?, image = ?, author = ?, is_published = ?, updated_at = datetime('now') WHERE id = ?",
    [payload.title, payload.excerpt, payload.content, payload.image, payload.author, payload.isPublished, id]
  );
  const row = await queryOne("SELECT * FROM blogs WHERE id = ?", [id]);
  return json({ blog: mapBlogRow(row) });
}

function normalizeBlogPayload(payload) {
  return {
    title: payload.title.trim(),
    excerpt: String(payload.excerpt || "").trim(),
    content: String(payload.content || "").trim(),
    image: String(payload.image || "").trim(),
    author: String(payload.author || "").trim(),
    isPublished: Boolean(payload.isPublished)
  };
}

async function deleteBlog(request, id) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const existing = await queryOne("SELECT id FROM blogs WHERE id = ?", [id]);
  if (!existing) return json({ error: "Blog post not found." }, 404);
  await execute("DELETE FROM blogs WHERE id = ?", [id]);
  return json({ ok: true });
}

async function adminBootstrapState() {
  const row = await queryOne("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
  return json({ hasAdmin: (Number(row?.count) || 0) > 0 });
}

async function getCustomers(request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const rows = await queryAll(
    "SELECT u.id, u.email, u.full_name, u.phone, u.address, u.city, u.created_at, u.updated_at, COUNT(o.id) AS order_count, COALESCE(SUM(o.subtotal), 0) AS total_spent FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE u.role = 'customer' GROUP BY u.id ORDER BY u.created_at DESC"
  );
  return json({
    customers: rows.map((row) => ({
      id: Number(row.id),
      email: row.email,
      fullName: row.full_name || "",
      phone: row.phone || "",
      address: row.address || "",
      city: row.city || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      orderCount: Number(row.order_count) || 0,
      totalSpent: Number(row.total_spent) || 0
    }))
  });
}

async function createAdminCustomer(request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const parsed = adminCustomerSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Invalid customer payload." }, 400);
  const payload = parsed.data;
  const email = normalizeEmail(payload.email);
  const existing = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) return json({ error: "A customer with this email already exists." }, 409);

  const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 12);
  await execute(
    "INSERT INTO users (email, password_hash, role, is_email_verified, full_name, phone, address, city) VALUES (?, ?, 'customer', true, ?, ?, ?, ?)",
    [email, passwordHash, payload.fullName.trim(), payload.phone.trim(), payload.address.trim(), payload.city.trim()]
  );
  const row = await queryOne("SELECT * FROM users WHERE email = ? AND role = 'customer'", [email]);
  return json({
    customer: {
      id: Number(row.id),
      email: row.email,
      fullName: row.full_name || "",
      phone: row.phone || "",
      address: row.address || "",
      city: row.city || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      orderCount: 0,
      totalSpent: 0
    }
  }, 201);
}

async function deleteCustomer(request, id) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const customerId = Number(id);
  if (!Number.isInteger(customerId) || customerId <= 0) return json({ error: "Invalid customer id." }, 400);
  const customer = await queryOne("SELECT id, role, email, full_name FROM users WHERE id = ?", [customerId]);
  if (!customer || customer.role !== "customer") return json({ error: "Customer not found." }, 404);
  await execute("DELETE FROM users WHERE id = ? AND role = 'customer'", [customerId]);
  return json({ ok: true, customer: { id: Number(customer.id), email: customer.email, fullName: customer.full_name || "" } });
}

async function createSubscription(request) {
  if (!checkRateLimit(request, "subscription")) return json({ error: "Too many requests. Please try again later." }, 429);
  const parsed = subscriptionSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "Enter a valid email address." }, 400);
  const email = normalizeEmail(parsed.data.email);
  const source = String(parsed.data.source || "footer").trim() || "footer";
  await execute(
    "INSERT INTO subscriptions (email, source) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET source = excluded.source",
    [email, source]
  );
  const emailResult = await sendNewsletterEmailsSafe({ email, source });
  return json({ ok: true, email, emailDelivered: Boolean(emailResult.customerDelivered) }, 201);
}

async function getSubscriptions(request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const rows = await queryAll("SELECT id, email, source, created_at FROM subscriptions ORDER BY created_at DESC");
  return json({ subscriptions: rows.map((row) => ({ id: Number(row.id), email: row.email, source: row.source, createdAt: row.created_at })) });
}

async function uploadImage(request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bucket = String(process.env.SUPABASE_STORAGE_BUCKET || "ife-shadesnmore").trim();
  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    return json({ error: "Supabase Storage is not configured." }, 503);
  }
  const form = await request.formData();
  const file = form.get("file");
  const requestedKind = String(form.get("kind") || "product").trim();
  const kind = ["product", "hero", "blog"].includes(requestedKind) ? requestedKind : "product";
  if (!file || typeof file === "string") return json({ error: "Image file is required." }, 400);
  if (!String(file.type || "").startsWith("image/")) return json({ error: "Only image uploads are allowed." }, 400);
  if (file.size > 10 * 1024 * 1024) return json({ error: "Image must be 10MB or smaller." }, 400);
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = sanitizeUploadFileName(file.name || "image");
  const folder = String(process.env.SUPABASE_STORAGE_FOLDER || "uploads").trim().replace(/^\/+|\/+$/g, "") || "uploads";
  const objectPath = `${folder}/${kind}/${crypto.randomUUID()}-${fileName}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": String(file.type || "application/octet-stream"),
      "x-upsert": "false"
    },
    body: buffer
  });
  const uploadPayload = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok) {
    return json({ error: uploadPayload?.message || "Could not upload image to Supabase Storage." }, uploadResponse.status);
  }
  const secureUrl = `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
  return json({
    secureUrl,
    publicId: objectPath,
    width: null,
    height: null,
    format: String(file.type || "").split("/")[1] || ""
  }, 201);
}

function sanitizeUploadFileName(value) {
  const fallbackExtension = "jpg";
  const raw = String(value || "image").trim().toLowerCase();
  const extension = raw.includes(".") ? raw.split(".").pop().replace(/[^a-z0-9]/g, "") : fallbackExtension;
  const base = raw
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "image";
  return `${base}.${extension || fallbackExtension}`;
}

function getOrderAlertRecipients() {
  const configured = String(process.env.ORDER_ALERT_EMAIL || process.env.ADMIN_EMAIL || "");
  return [...new Set(configured.split(",").map((entry) => normalizeEmail(entry)).filter(Boolean))];
}

function getNewsletterAlertRecipients() {
  const configured = String(process.env.NEWSLETTER_ALERT_EMAIL || process.env.ORDER_ALERT_EMAIL || process.env.ADMIN_EMAIL || "");
  return [...new Set(configured.split(",").map((entry) => normalizeEmail(entry)).filter(Boolean))];
}

async function sendNewsletterEmailsSafe({ email, source }) {
  if (!NEWSLETTER_EMAIL_ENABLED) return { customerDelivered: false, adminDelivered: false, skipped: "disabled" };

  let customerDelivered = false;
  try {
    const result = await sendNewsletterWelcome({ toEmail: email, source });
    customerDelivered = Boolean(result?.delivered);
  } catch (error) {
    console.error("Could not send newsletter welcome email:", {
      message: error?.message || "",
      mailer: getMailerRuntimeInfo()
    });
  }

  let adminDeliveredCount = 0;
  for (const toEmail of getNewsletterAlertRecipients()) {
    try {
      const result = await sendNewsletterAdminNotification({ toEmail, subscriberEmail: email, source });
      if (result?.delivered) adminDeliveredCount += 1;
    } catch (error) {
      console.error("Could not send newsletter admin notification email:", {
        message: error?.message || "",
        mailer: getMailerRuntimeInfo()
      });
    }
  }

  return {
    customerDelivered,
    adminDelivered: adminDeliveredCount > 0,
    adminDeliveredCount
  };
}

async function sendOrderAlertSafe({ orderId }) {
  const recipients = getOrderAlertRecipients();
  if (recipients.length === 0) return { delivered: false, skipped: "missing_recipient" };
  const row = await queryOne("SELECT * FROM orders WHERE id = ?", [orderId]);
  if (!row || row.admin_notified_at) return { delivered: Boolean(row?.admin_notified_at) };
  const order = mapOrderRow(row);
  const items = await getOrderItems(orderId);
  let deliveredCount = 0;
  for (const toEmail of recipients) {
    try {
      const result = await sendOrderNotification({ toEmail, order, items });
      if (result?.delivered) deliveredCount += 1;
    } catch (error) {
      console.error("Could not send order notification email:", { message: error?.message || "", mailer: getMailerRuntimeInfo() });
    }
  }
  if (deliveredCount > 0) {
    await execute("UPDATE orders SET admin_notified_at = COALESCE(admin_notified_at, datetime('now')), updated_at = datetime('now') WHERE id = ?", [orderId]);
  }
  return { delivered: deliveredCount > 0, deliveredCount };
}

async function sendCustomerOrderAlertSafe({ orderId }) {
  if (!CUSTOMER_ORDER_EMAIL_ENABLED) return { delivered: false, skipped: "disabled" };
  const row = await queryOne("SELECT * FROM orders WHERE id = ?", [orderId]);
  if (!row || row.customer_notified_at) return { delivered: Boolean(row?.customer_notified_at) };
  const toEmail = normalizeEmail(row.email || "");
  if (!toEmail) return { delivered: false, skipped: "missing_customer_email" };
  try {
    const result = await sendCustomerOrderConfirmation({ toEmail, order: mapOrderRow(row), items: await getOrderItems(orderId) });
    if (result?.delivered) {
      await execute("UPDATE orders SET customer_notified_at = COALESCE(customer_notified_at, datetime('now')), updated_at = datetime('now') WHERE id = ?", [orderId]);
      return { delivered: true };
    }
  } catch (error) {
    console.error("Could not send customer order confirmation email:", { message: error?.message || "", mailer: getMailerRuntimeInfo() });
  }
  return { delivered: false };
}
