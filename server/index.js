import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { z } from "zod";
import {
  execute,
  initDatabase,
  mapProductRow,
  mapSettingsRow,
  mapUserRow,
  queryAll,
  queryOne,
  withTransaction
} from "./db.js";
import {
  clearAuthCookie,
  getCurrentUserFromRequest,
  requireAdmin,
  requireAuth,
  setAuthCookie
} from "./auth.js";
import {
  getPaystackConfigurationError,
  initializeTransaction,
  isPaystackConfigured,
  verifyTransaction,
  verifyWebhookSignature
} from "./paystack.js";
import {
  getMailerRuntimeInfo,
  sendCustomerOrderConfirmation,
  sendEmailVerification,
  sendOrderNotification
} from "./mailer.js";
import {
  DEFAULT_FEATURE_ITEMS,
  DEFAULT_HERO_PROMISE_ITEMS,
  DEFAULT_PRODUCT_DETAIL_BULLETS
} from "./defaults.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const CORS_ORIGIN = process.env.CORS_ORIGIN || FRONTEND_URL;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, "..", "dist");
const DIST_INDEX_HTML = path.join(DIST_DIR, "index.html");

function resolveTrustProxy(rawValue) {
  const normalized = String(rawValue ?? "").trim().toLowerCase();
  if (!normalized) return process.env.NODE_ENV === "production" ? 1 : false;
  if (["true", "1", "yes", "on"].includes(normalized)) return 1;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  const asNumber = Number(normalized);
  if (Number.isInteger(asNumber) && asNumber >= 0) return asNumber;
  return rawValue;
}

app.set("trust proxy", resolveTrustProxy(process.env.TRUST_PROXY));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        scriptSrc: ["'self'", "https://www.googletagmanager.com"],
        connectSrc: [
          "'self'",
          "https://www.googletagmanager.com",
          "https://www.google-analytics.com",
          "https://region1.google-analytics.com"
        ]
      }
    }
  })
);
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true
  })
);
app.use(cookieParser());

app.post("/api/paystack/webhook", express.raw({ type: "*/*" }), async (req, res) => {
  const verification = verifyWebhookSignature(req.body, req.headers["x-paystack-signature"]);
  if (!verification.ok) {
    if (verification.reason === "missing_secret") {
      res.status(204).end();
      return;
    }
    if (verification.reason === "missing_signature" || verification.reason === "invalid_signature") {
      res.status(401).end();
      return;
    }
    res.status(204).end();
    return;
  }

  let event;
  try {
    event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "{}"));
  } catch {
    res.status(400).end();
    return;
  }

  if (event?.event === "charge.success") {
    const reference = event?.data?.reference;
    const channel = event?.data?.channel || "";
    const amountKobo = Number(event?.data?.amount || 0);
    if (reference) {
      const order = await queryOne(
        "SELECT id, subtotal FROM orders WHERE payment_reference = ?",
        [reference]
      );
      if (order && amountKobo === Number(order.subtotal || 0) * 100) {
        await execute(
          `
            UPDATE orders
            SET payment_status = 'paid',
                payment_channel = ?,
                order_status = CASE WHEN order_status = 'pending' THEN 'processing' ELSE order_status END,
                updated_at = datetime('now')
            WHERE id = ?
          `,
          [channel, order.id]
        );
        await sendOrderAlertSafe({ orderId: order.id });
        await sendCustomerOrderAlertSafe({ orderId: order.id });
      }
    }
  }

  res.status(200).json({ ok: true });
});

app.use(express.json({ limit: "15mb" }));

function createOrderId() {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const nonce = Math.floor(Math.random() * 9000 + 1000);
  return `IFE-${timestamp}-${nonce}`;
}

function createPaymentReference() {
  const suffix = crypto.randomBytes(6).toString("hex");
  return `IFE_REF_${Date.now()}_${suffix}`;
}

function hashVerificationToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken || "")).digest("hex");
}

async function createVerificationToken(userId) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS).toISOString();

  await execute(
    `
      DELETE FROM email_verification_tokens
      WHERE user_id = ? AND consumed_at IS NULL
    `,
    [userId]
  );

  await execute(
    `
      INSERT INTO email_verification_tokens (
        user_id, token_hash, expires_at
      )
      VALUES (?, ?, ?)
    `,
    [userId, tokenHash, expiresAt]
  );

  const verificationUrl = `${FRONTEND_URL}/account/verify-email?token=${encodeURIComponent(rawToken)}`;
  return { rawToken, verificationUrl, expiresAt };
}

async function sendVerificationEmailSafe({ toEmail, fullName, verificationUrl }) {
  try {
    return await sendEmailVerification({ toEmail, fullName, verificationUrl });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Could not send verification email:", {
      message: error?.message || "",
      code: error?.code || "",
      command: error?.command || "",
      responseCode: error?.responseCode || "",
      response: error?.response || "",
      mailerTarget: error?.mailerTarget || null,
      mailerAttempted: error?.mailerAttempted || null,
      stack: error?.stack || "",
      mailer: getMailerRuntimeInfo()
    });
    return { delivered: false };
  }
}

function getOrderAlertRecipients() {
  const configured = String(process.env.ORDER_ALERT_EMAIL || process.env.ADMIN_EMAIL || "");
  return [...new Set(configured.split(",").map((entry) => normalizeEmail(entry)).filter(Boolean))];
}

function parseBooleanEnv(value, fallback = false) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

const CUSTOMER_ORDER_EMAIL_ENABLED = parseBooleanEnv(
  process.env.CUSTOMER_ORDER_EMAIL_ENABLED,
  true
);

async function sendOrderAlertSafe({ orderId }) {
  const recipients = getOrderAlertRecipients();
  if (recipients.length === 0) return { delivered: false, skipped: "missing_recipient" };

  const row = await queryOne("SELECT * FROM orders WHERE id = ?", [orderId]);
  if (!row) return { delivered: false, skipped: "order_missing" };
  if (row.admin_notified_at) return { delivered: true, skipped: "already_sent" };

  const order = mapOrderRow(row);
  const items = await getOrderItems(orderId);
  let deliveredCount = 0;

  for (const toEmail of recipients) {
    try {
      const result = await sendOrderNotification({ toEmail, order, items });
      if (result?.delivered) {
        deliveredCount += 1;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Could not send order notification email:", {
        message: error?.message || "",
        code: error?.code || "",
        command: error?.command || "",
        responseCode: error?.responseCode || "",
        response: error?.response || "",
        mailerTarget: error?.mailerTarget || null,
        mailerAttempted: error?.mailerAttempted || null,
        stack: error?.stack || "",
        mailer: getMailerRuntimeInfo()
      });
    }
  }

  if (deliveredCount > 0) {
    await execute(
      `
        UPDATE orders
        SET admin_notified_at = COALESCE(admin_notified_at, datetime('now')),
            updated_at = datetime('now')
        WHERE id = ?
      `,
      [orderId]
    );
    return { delivered: true, deliveredCount };
  }

  return { delivered: false, deliveredCount: 0 };
}

async function sendCustomerOrderAlertSafe({ orderId }) {
  if (!CUSTOMER_ORDER_EMAIL_ENABLED) {
    return { delivered: false, skipped: "disabled" };
  }

  const row = await queryOne("SELECT * FROM orders WHERE id = ?", [orderId]);
  if (!row) return { delivered: false, skipped: "order_missing" };
  if (row.customer_notified_at) return { delivered: true, skipped: "already_sent" };

  const toEmail = normalizeEmail(row.email || "");
  if (!toEmail) return { delivered: false, skipped: "missing_customer_email" };

  const order = mapOrderRow(row);
  const items = await getOrderItems(orderId);

  try {
    const result = await sendCustomerOrderConfirmation({
      toEmail,
      order,
      items
    });
    if (!result?.delivered) return { delivered: false };

    await execute(
      `
        UPDATE orders
        SET customer_notified_at = COALESCE(customer_notified_at, datetime('now')),
            updated_at = datetime('now')
        WHERE id = ?
      `,
      [orderId]
    );
    return { delivered: true };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Could not send customer order confirmation email:", {
      message: error?.message || "",
      code: error?.code || "",
      command: error?.command || "",
      responseCode: error?.responseCode || "",
      response: error?.response || "",
      mailerTarget: error?.mailerTarget || null,
      mailerAttempted: error?.mailerAttempted || null,
      stack: error?.stack || "",
      mailer: getMailerRuntimeInfo()
    });
    return { delivered: false };
  }
}

async function getStorefrontPayload() {
  const settingsRow = await queryOne("SELECT * FROM settings WHERE id = 1");
  const productsRows = await queryAll("SELECT * FROM products ORDER BY created_at DESC");

  return {
    settings: settingsRow ? mapSettingsRow(settingsRow) : null,
    products: productsRows.map(mapProductRow)
  };
}

async function getOrderItems(orderId) {
  const rows = await queryAll(
      `
        SELECT id, product_id, name, availability, preorder_note, unit_price, quantity, line_total
        FROM order_items
        WHERE order_id = ?
        ORDER BY id ASC
      `,
      [orderId]
    );

  return rows.map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.name,
      availability: normalizeProductAvailability(item.availability),
      preorderNote:
        normalizeProductAvailability(item.availability) === "preorder"
          ? normalizePreorderNote(item.preorder_note)
          : "",
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
  return Promise.all(
    rows.map(async (row) => {
    const order = mapOrderRow(row);
      return { ...order, items: await getOrderItems(order.id) };
    })
  );
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

const PRODUCT_AUDIENCE_VALUES = ["women", "men", "sunglasses", "unisex", "antiblue", "prescrip"];
const PRODUCT_AUDIENCE_SET = new Set(PRODUCT_AUDIENCE_VALUES);
const PRODUCT_AVAILABILITY_VALUES = ["in_stock", "out_of_stock", "preorder"];
const PRODUCT_AVAILABILITY_SET = new Set(PRODUCT_AVAILABILITY_VALUES);

function normalizeAudienceValue(value) {
  const source = String(value || "").trim().toLowerCase();
  if (!source) return "unisex";
  if (PRODUCT_AUDIENCE_SET.has(source)) return source;

  const compact = source.replace(/[^a-z]/g, "");
  if (
    compact.includes("women") ||
    compact.includes("woman") ||
    compact.includes("female") ||
    compact.includes("lady")
  ) {
    return "women";
  }
  if (compact === "men" || compact === "man" || compact.includes("male") || compact.includes("gent")) {
    return "men";
  }
  if (compact.includes("sunglass") || compact.includes("shades")) return "sunglasses";
  if (compact.includes("antiblue") || compact.includes("bluelight") || compact.includes("antiglare")) {
    return "antiblue";
  }
  if (compact.includes("prescrip") || compact.includes("prescription") || compact === "rx") {
    return "prescrip";
  }
  if (compact.includes("unisex")) return "unisex";
  return "unisex";
}

function normalizeAudienceList(rawValue) {
  const source = Array.isArray(rawValue)
    ? rawValue
    : String(rawValue || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
  const normalized = source.map(normalizeAudienceValue).filter((value) => PRODUCT_AUDIENCE_SET.has(value));
  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique : ["unisex"];
}

function normalizeProductAvailability(value) {
  const source = String(value || "").trim().toLowerCase();
  if (!source) return "in_stock";
  if (PRODUCT_AVAILABILITY_SET.has(source)) return source;

  const compact = source.replace(/[^a-z]/g, "");
  if (compact === "instock" || compact === "available") return "in_stock";
  if (compact === "outofstock" || compact === "soldout" || compact === "unavailable") {
    return "out_of_stock";
  }
  if (compact === "preorder" || compact === "preorderonly") return "preorder";
  return "in_stock";
}

function normalizePreorderNote(value) {
  return String(value || "").trim().slice(0, 180);
}

function normalizeDetailBullets(rawValue) {
  const source = Array.isArray(rawValue) ? rawValue : [];
  const normalized = source
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
      `
        UPDATE users
        SET password_hash = ?, role = 'admin', is_email_verified = true, updated_at = datetime('now')
        WHERE id = ?
      `,
      [passwordHash, existing.id]
    );
    return;
  }

  await execute(
    `
      INSERT INTO users (email, password_hash, role, is_email_verified, full_name)
      VALUES (?, ?, 'admin', true, 'Administrator')
    `,
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
    phone: z.string().max(40).optional().default(""),
    address: z.string().max(300).optional().default(""),
    city: z.string().max(120).optional().default("")
  })
  .refine(
    (value) =>
      (Boolean(`${value.firstName || ""}`.trim()) && Boolean(`${value.lastName || ""}`.trim())) ||
      Boolean(`${value.fullName || ""}`.trim()),
    {
      message: "First and last name are required.",
      path: ["firstName"]
    }
  );

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const verifyEmailSchema = z.object({
  token: z.string().min(20).max(500)
});

const resendVerificationSchema = z.object({
  email: z.string().email()
});

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

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().min(1).max(99)
      })
    )
    .min(1),
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
      {
        message: "First and last name are required.",
        path: ["firstName"]
      }
    )
});

const orderStatusSchema = z.object({
  orderStatus: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"])
});

const subscriptionSchema = z.object({
  email: z.string().email(),
  source: z.string().min(1).max(40).optional().default("footer")
});

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.get("/api/storefront", async (_, res, next) => {
  try {
    res.json(await getStorefrontPayload());
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", async (req, res, next) => {
  try {
    const user = await getCurrentUserFromRequest(req);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid registration payload." });
    return;
  }

  const payload = parsed.data;
  const email = normalizeEmail(payload.email);
  const fullName = `${payload.firstName || ""} ${payload.lastName || ""}`.trim() || payload.fullName.trim();

  const existing = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) {
    res.status(409).json({ error: "Email already in use." });
    return;
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  await execute(
    `
      INSERT INTO users (email, password_hash, role, is_email_verified, full_name, phone, address, city)
      VALUES (?, ?, 'customer', false, ?, ?, ?, ?)
    `,
    [
      email,
      passwordHash,
      fullName,
      payload.phone.trim(),
      payload.address.trim(),
      payload.city.trim()
    ]
  );

  const userRow = await queryOne("SELECT * FROM users WHERE email = ?", [email]);
  const verification = await createVerificationToken(userRow.id);
  const delivery = await sendVerificationEmailSafe({
    toEmail: userRow.email,
    fullName: userRow.full_name,
    verificationUrl: verification.verificationUrl
  });
  const message = delivery.delivered
    ? "Account created. Please verify your email before login."
    : "Account created, but verification email could not be delivered. Please use Resend Verification Email.";

  res.status(201).json({
    ok: true,
    requiresEmailVerification: true,
    message
  });
});

app.post("/api/auth/verify-email", authLimiter, async (req, res, next) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid verification token." });
    return;
  }

  try {
    const tokenHash = hashVerificationToken(parsed.data.token);
    const tokenRow = await queryOne(
      `
        SELECT evt.id, evt.user_id, evt.expires_at, u.*
        FROM email_verification_tokens evt
        INNER JOIN users u ON u.id = evt.user_id
        WHERE evt.token_hash = ?
          AND evt.consumed_at IS NULL
        LIMIT 1
      `,
      [tokenHash]
    );

    if (!tokenRow) {
      res.status(400).json({ error: "Verification link is invalid or already used." });
      return;
    }

    const expiresAtMs = Date.parse(tokenRow.expires_at);
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      await execute(
        `
          UPDATE email_verification_tokens
          SET consumed_at = datetime('now')
          WHERE id = ?
        `,
        [tokenRow.id]
      );
      res.status(400).json({ error: "Verification link has expired. Request a new one." });
      return;
    }

    await withTransaction(async (tx) => {
      await tx.execute(
        `
          UPDATE users
          SET is_email_verified = true, updated_at = datetime('now')
          WHERE id = ?
        `,
        [tokenRow.user_id]
      );

      await tx.execute(
        `
          UPDATE email_verification_tokens
          SET consumed_at = datetime('now')
          WHERE user_id = ? AND consumed_at IS NULL
        `,
        [tokenRow.user_id]
      );
    });

    const userRow = await queryOne("SELECT * FROM users WHERE id = ?", [tokenRow.user_id]);
    const user = mapUserRow(userRow);
    setAuthCookie(res, user);
    res.json({ ok: true, user, message: "Email verified successfully." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/resend-verification", authLimiter, async (req, res) => {
  const parsed = resendVerificationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const userRow = await queryOne("SELECT * FROM users WHERE email = ?", [email]);

  if (!userRow || userRow.role !== "customer") {
    res.json({ ok: true, message: "If this account exists, a verification email has been sent." });
    return;
  }

  if (Boolean(userRow.is_email_verified)) {
    res.json({ ok: true, message: "Email is already verified." });
    return;
  }

  const verification = await createVerificationToken(userRow.id);
  const delivery = await sendVerificationEmailSafe({
    toEmail: userRow.email,
    fullName: userRow.full_name,
    verificationUrl: verification.verificationUrl
  });
  const message = delivery.delivered
    ? "Verification email sent."
    : "Verification email could not be delivered right now. Please try again later.";

  res.json({
    ok: true,
    message
  });
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid login payload." });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const userRow = await queryOne("SELECT * FROM users WHERE email = ?", [email]);
  if (!userRow) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, userRow.password_hash);
  if (!passwordMatches) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  if (userRow.role === "customer" && !Boolean(userRow.is_email_verified)) {
    res.status(403).json({
      error: "Please verify your email before logging in.",
      requiresEmailVerification: true,
      email: userRow.email
    });
    return;
  }

  const user = mapUserRow(userRow);
  setAuthCookie(res, user);
  res.json({ user });
});

app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.patch("/api/auth/profile", requireAuth, async (req, res, next) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile payload." });
    return;
  }

  try {
    const payload = parsed.data;
    await execute(
      `
        UPDATE users
        SET full_name = ?, phone = ?, address = ?, city = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      [payload.fullName.trim(), payload.phone.trim(), payload.address.trim(), payload.city.trim(), req.user.id]
    );

    const userRow = await queryOne("SELECT * FROM users WHERE id = ?", [req.user.id]);
    res.json({ user: mapUserRow(userRow) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/auth/password", requireAuth, async (req, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid password payload." });
    return;
  }

  const userRow = await queryOne("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!userRow) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const currentPasswordMatches = await bcrypt.compare(
    parsed.data.currentPassword,
    userRow.password_hash
  );
  if (!currentPasswordMatches) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }

  const isSamePassword = await bcrypt.compare(parsed.data.newPassword, userRow.password_hash);
  if (isSamePassword) {
    res.status(400).json({ error: "New password must be different from current password." });
    return;
  }

  const nextHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await execute(
    `
      UPDATE users
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `,
    [nextHash, req.user.id]
  );

  res.json({ ok: true, message: "Password updated successfully." });
});

app.get("/api/orders/my", requireAuth, async (req, res, next) => {
  try {
    const rows = await queryAll(
      `
        SELECT *
        FROM orders
        WHERE user_id = ?
        ORDER BY created_at DESC
      `,
      [req.user.id]
    );
    res.json({ orders: await withOrderItems(rows) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders", requireAdmin, async (_req, res, next) => {
  try {
    const rows = await queryAll("SELECT * FROM orders ORDER BY created_at DESC");
    res.json({ orders: await withOrderItems(rows) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/orders/:id/status", requireAdmin, async (req, res, next) => {
  const parsed = orderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order status payload." });
    return;
  }

  try {
    const order = await queryOne("SELECT * FROM orders WHERE id = ?", [req.params.id]);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    await execute(
      `
        UPDATE orders
        SET order_status = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      [parsed.data.orderStatus, req.params.id]
    );

    const refreshed = await queryOne("SELECT * FROM orders WHERE id = ?", [req.params.id]);
    res.json({ order: { ...mapOrderRow(refreshed), items: await getOrderItems(req.params.id) } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/checkout/initialize", requireAuth, async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid checkout payload." });
    return;
  }

  if (!isPaystackConfigured()) {
    res
      .status(503)
      .json({ error: getPaystackConfigurationError() || "Payment provider is not configured yet." });
    return;
  }

  const payload = parsed.data;
  const uniqueIds = [...new Set(payload.items.map((item) => item.productId))];
  const placeholders = uniqueIds.map(() => "?").join(",");
  const productsRows = await queryAll(
    `SELECT * FROM products WHERE id IN (${placeholders})`,
    uniqueIds
  );
  const products = productsRows.map(mapProductRow);

  const productMap = new Map(products.map((product) => [product.id, product]));
  const unavailableProducts = payload.items
    .map((item) => productMap.get(item.productId))
    .filter((product) => product && product.availability === "out_of_stock")
    .map((product) => product.name);

  if (unavailableProducts.length > 0) {
    res.status(409).json({
      error: `Out-of-stock item(s) detected: ${[...new Set(unavailableProducts)].join(", ")}. Please update your cart.`
    });
    return;
  }

  const computedItems = payload.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) return null;
    const availability = normalizeProductAvailability(product.availability);
    const preorderNote = availability === "preorder" ? normalizePreorderNote(product.preorderNote) : "";
    const lineTotal = product.price * item.quantity;
    return {
      productId: product.id,
      name: product.name,
      availability,
      preorderNote,
      unitPrice: product.price,
      quantity: item.quantity,
      lineTotal
    };
  });

  if (computedItems.some((item) => item === null)) {
    res.status(400).json({ error: "One or more products are invalid." });
    return;
  }

  const validItems = computedItems.filter(Boolean);
  const subtotal = validItems.reduce((sum, item) => sum + item.lineTotal, 0);
  if (subtotal <= 0) {
    res.status(400).json({ error: "Invalid checkout amount." });
    return;
  }

  const orderId = createOrderId();
  const reference = createPaymentReference();
  const customer = payload.customer;
  const customerFullName =
    `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.fullName.trim();
  const customerEmail = normalizeEmail(customer.email || "");
  const customerPhone = String(customer.phone || "").trim();

  await withTransaction(async (tx) => {
    await tx.execute(
      `
        INSERT INTO orders (
          id, user_id, email, full_name, phone, address, city,
          payment_method, payment_reference, payment_status, subtotal
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `,
      [
        orderId,
        req.user.id,
        customerEmail || req.user.email,
        customerFullName,
        customerPhone,
        customer.address.trim(),
        customer.city.trim(),
        payload.paymentMethod,
        reference,
        subtotal
      ]
    );

    for (const item of validItems) {
      await tx.execute(
        `
          INSERT INTO order_items (
            order_id, product_id, name, availability, preorder_note, unit_price, quantity, line_total
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          item.productId,
          item.name,
          item.availability,
          item.preorderNote,
          item.unitPrice,
          item.quantity,
          item.lineTotal
        ]
      );
    }
  });

  try {
    const channels = payload.paymentMethod === "transfer" ? ["bank_transfer", "bank"] : ["card"];
    const checkout = await initializeTransaction({
      email: customerEmail || req.user.email,
      amountInKobo: subtotal * 100,
      reference,
      callbackUrl: `${FRONTEND_URL}/payment/callback`,
      channels,
      metadata: {
        orderId,
        userId: req.user.id
      }
    });

    await execute(
      `
        UPDATE users
        SET full_name = ?, phone = ?, address = ?, city = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      [customerFullName, customerPhone, customer.address.trim(), customer.city.trim(), req.user.id]
    );

    res.json({
      orderId,
      reference,
      authorizationUrl: checkout.authorization_url,
      accessCode: checkout.access_code
    });
  } catch (error) {
    await execute(
      `
        UPDATE orders
        SET payment_status = 'failed', updated_at = datetime('now')
        WHERE id = ?
      `,
      [orderId]
    );
    res.status(502).json({ error: error.message || "Could not initialize payment." });
  }
});

app.get("/api/checkout/verify", requireAuth, async (req, res) => {
  const reference = String(req.query.reference || "").trim();
  if (!reference) {
    res.status(400).json({ error: "Payment reference is required." });
    return;
  }

  const orderRow = await queryOne(
    "SELECT * FROM orders WHERE payment_reference = ? AND user_id = ?",
    [reference, req.user.id]
  );

  if (!orderRow) {
    res.status(404).json({ error: "Order not found for this account." });
    return;
  }

  try {
    const payment = await verifyTransaction(reference);
    const paystackStatus = String(payment.status || "").toLowerCase();
    const amountKobo = Number(payment.amount || 0);
    const expectedKobo = Number(orderRow.subtotal || 0) * 100;
    const isPaid = paystackStatus === "success" && amountKobo === expectedKobo;

    await execute(
      `
        UPDATE orders
        SET payment_status = ?, payment_channel = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      [isPaid ? "paid" : "failed", payment.channel || "", orderRow.id]
    );

    if (isPaid) {
      await sendOrderAlertSafe({ orderId: orderRow.id });
      await sendCustomerOrderAlertSafe({ orderId: orderRow.id });
    }

    const refreshed = await queryOne("SELECT * FROM orders WHERE id = ?", [orderRow.id]);
    res.json({
      order: { ...mapOrderRow(refreshed), items: await getOrderItems(refreshed.id) },
      payment: {
        status: isPaid ? "paid" : "failed",
        gatewayStatus: paystackStatus,
        reference: payment.reference || reference,
        channel: payment.channel || ""
      }
    });
  } catch (error) {
    res.status(502).json({ error: error.message || "Could not verify payment." });
  }
});

app.patch("/api/settings", requireAdmin, async (req, res, next) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid settings payload." });
    return;
  }

  try {
    const payload = parsed.data;
    await execute(
      `
        UPDATE settings
        SET brand_name = ?, brand_tagline = ?, hero_title = ?, hero_subtitle = ?,
            hero_button_label = ?, hero_image = ?, hero_promise_items = ?, feature_items = ?,
            updated_at = datetime('now')
        WHERE id = 1
      `,
      [
        payload.brandName.trim(),
        payload.brandTagline.trim(),
        payload.heroTitle.trim(),
        payload.heroSubtitle.trim(),
        payload.heroButtonLabel.trim(),
        payload.heroImage.trim(),
        JSON.stringify(payload.heroPromiseItems || DEFAULT_HERO_PROMISE_ITEMS),
        JSON.stringify(payload.featureItems || DEFAULT_FEATURE_ITEMS)
      ]
    );

    const row = await queryOne("SELECT * FROM settings WHERE id = 1");
    res.json({ settings: mapSettingsRow(row) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/products", requireAdmin, async (req, res, next) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product payload." });
    return;
  }

  try {
    const payload = parsed.data;
    const id = payload.id || crypto.randomUUID();
    const audienceList = normalizeAudienceList(
      Array.isArray(payload.audiences) && payload.audiences.length > 0 ? payload.audiences : payload.audience
    );
    const detailBullets = normalizeDetailBullets(payload.detailBullets);
    const availability = normalizeProductAvailability(payload.availability);
    const preorderNote = availability === "preorder" ? normalizePreorderNote(payload.preorderNote) : "";

    await execute(
      `
        INSERT INTO products (
          id, name, price, section, audience, availability, preorder_note, cta_label, description, detail_bullets, variant, image
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        payload.name.trim(),
        payload.price,
        payload.section,
        audienceList.join(","),
        availability,
        preorderNote,
        payload.ctaLabel.trim(),
        payload.description.trim(),
        JSON.stringify(detailBullets),
        payload.variant.trim() || "round",
        payload.image.trim()
      ]
    );

    const row = await queryOne("SELECT * FROM products WHERE id = ?", [id]);
    res.status(201).json({ product: mapProductRow(row) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/products/:id", requireAdmin, async (req, res, next) => {
  const parsed = productSchema.safeParse({ ...req.body, id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product payload." });
    return;
  }

  try {
    const payload = parsed.data;
    const existing = await queryOne("SELECT id FROM products WHERE id = ?", [req.params.id]);
    if (!existing) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    const audienceList = normalizeAudienceList(
      Array.isArray(payload.audiences) && payload.audiences.length > 0 ? payload.audiences : payload.audience
    );
    const detailBullets = normalizeDetailBullets(payload.detailBullets);
    const availability = normalizeProductAvailability(payload.availability);
    const preorderNote = availability === "preorder" ? normalizePreorderNote(payload.preorderNote) : "";

    await execute(
      `
        UPDATE products
        SET name = ?, price = ?, section = ?, audience = ?, availability = ?, preorder_note = ?,
            cta_label = ?, description = ?, detail_bullets = ?, variant = ?, image = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      [
        payload.name.trim(),
        payload.price,
        payload.section,
        audienceList.join(","),
        availability,
        preorderNote,
        payload.ctaLabel.trim(),
        payload.description.trim(),
        JSON.stringify(detailBullets),
        payload.variant.trim() || "round",
        payload.image.trim(),
        req.params.id
      ]
    );

    const row = await queryOne("SELECT * FROM products WHERE id = ?", [req.params.id]);
    res.json({ product: mapProductRow(row) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/products/:id", requireAdmin, async (req, res, next) => {
  try {
    const existing = await queryOne("SELECT id FROM products WHERE id = ?", [req.params.id]);
    if (!existing) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    await execute("DELETE FROM products WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/bootstrap-state", async (_, res, next) => {
  try {
    const row = await queryOne("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
    const count = Number(row?.count) || 0;
    res.json({ hasAdmin: count > 0 });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/customers", requireAdmin, async (_req, res, next) => {
  try {
    const rows = await queryAll(
      `
        SELECT
          u.id,
          u.email,
          u.full_name,
          u.phone,
          u.address,
          u.city,
          u.created_at,
          u.updated_at,
          COUNT(o.id) AS order_count,
          COALESCE(SUM(o.subtotal), 0) AS total_spent
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id
        WHERE u.role = 'customer'
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `
    );

    res.json({
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
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/customers/:id", requireAdmin, async (req, res, next) => {
  const customerId = Number(req.params.id);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    res.status(400).json({ error: "Invalid customer id." });
    return;
  }

  try {
    const customer = await queryOne(
      `
        SELECT id, role, email, full_name
        FROM users
        WHERE id = ?
      `,
      [customerId]
    );

    if (!customer || customer.role !== "customer") {
      res.status(404).json({ error: "Customer not found." });
      return;
    }

    await execute(
      `
        DELETE FROM users
        WHERE id = ? AND role = 'customer'
      `,
      [customerId]
    );

    res.json({
      ok: true,
      customer: {
        id: Number(customer.id),
        email: customer.email,
        fullName: customer.full_name || ""
      }
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/subscriptions", authLimiter, async (req, res, next) => {
  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  try {
    const email = normalizeEmail(parsed.data.email);
    const source = String(parsed.data.source || "footer").trim() || "footer";

    await execute(
      `
        INSERT INTO subscriptions (email, source)
        VALUES (?, ?)
        ON CONFLICT(email) DO UPDATE SET source = excluded.source
      `,
      [email, source]
    );

    res.status(201).json({ ok: true, email });
  } catch (error) {
    next(error);
  }
});

app.get("/api/subscriptions", requireAdmin, async (_req, res, next) => {
  try {
    const rows = await queryAll(
      `
        SELECT id, email, source, created_at
        FROM subscriptions
        ORDER BY created_at DESC
      `
    );

    res.json({
      subscriptions: rows.map((row) => ({
        id: Number(row.id),
        email: row.email,
        source: row.source,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(DIST_INDEX_HTML);
  });
}

app.use((err, _req, res, _next) => {
  const message = err?.message || "Unexpected server error.";
  res.status(500).json({ error: message });
});

initDatabase()
  .then(() => bootstrapAdminIfConfigured())
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`API server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize server:", error);
    process.exit(1);
  });
