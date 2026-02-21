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
import { db, mapProductRow, mapSettingsRow, mapUserRow } from "./db.js";
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
import { sendEmailVerification } from "./mailer.js";

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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true
  })
);
app.use(cookieParser());

app.post("/api/paystack/webhook", express.raw({ type: "*/*" }), (req, res) => {
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
      const order = db.prepare("SELECT id, subtotal FROM orders WHERE payment_reference = ?").get(reference);
      if (order && amountKobo === Number(order.subtotal || 0) * 100) {
        db.prepare(
          `
            UPDATE orders
            SET payment_status = 'paid',
                payment_channel = ?,
                order_status = CASE WHEN order_status = 'pending' THEN 'processing' ELSE order_status END,
                updated_at = datetime('now')
            WHERE id = ?
          `
        ).run(channel, order.id);
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

function createVerificationToken(userId) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS).toISOString();

  db.prepare(
    `
      DELETE FROM email_verification_tokens
      WHERE user_id = ? AND consumed_at IS NULL
    `
  ).run(userId);

  db.prepare(
    `
      INSERT INTO email_verification_tokens (
        user_id, token_hash, expires_at
      )
      VALUES (?, ?, ?)
    `
  ).run(userId, tokenHash, expiresAt);

  const verificationUrl = `${FRONTEND_URL}/account/verify-email?token=${encodeURIComponent(rawToken)}`;
  return { rawToken, verificationUrl, expiresAt };
}

async function sendVerificationEmailSafe({ toEmail, fullName, verificationUrl }) {
  try {
    return await sendEmailVerification({ toEmail, fullName, verificationUrl });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Could not send verification email:", error);
    return { delivered: false };
  }
}

function getStorefrontPayload() {
  const settingsRow = db.prepare("SELECT * FROM settings WHERE id = 1").get();
  const productsRows = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();

  return {
    settings: settingsRow ? mapSettingsRow(settingsRow) : null,
    products: productsRows.map(mapProductRow)
  };
}

function getOrderItems(orderId) {
  return db
    .prepare(
      `
        SELECT id, product_id, name, unit_price, quantity, line_total
        FROM order_items
        WHERE order_id = ?
        ORDER BY id ASC
      `
    )
    .all(orderId)
    .map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.name,
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
    subtotal: Number(row.subtotal) || 0,
    currency: row.currency || "NGN",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function withOrderItems(rows) {
  return rows.map((row) => {
    const order = mapOrderRow(row);
    return { ...order, items: getOrderItems(order.id) };
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function bootstrapAdminIfConfigured() {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const adminPassword = String(process.env.ADMIN_PASSWORD || "").trim();
  if (!adminEmail || !adminPassword) return;

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  if (existing) {
    db.prepare(
      `
        UPDATE users
        SET password_hash = ?, role = 'admin', is_email_verified = 1, updated_at = datetime('now')
        WHERE id = ?
      `
    ).run(passwordHash, existing.id);
    return;
  }

  db.prepare(
    `
      INSERT INTO users (email, password_hash, role, is_email_verified, full_name)
      VALUES (?, ?, 'admin', 1, 'Administrator')
    `
  ).run(adminEmail, passwordHash);
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(120),
  phone: z.string().max(40).optional().default(""),
  address: z.string().max(300).optional().default(""),
  city: z.string().max(120).optional().default("")
});

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

const settingsSchema = z.object({
  brandName: z.string().min(1).max(120),
  brandTagline: z.string().min(1).max(80),
  heroTitle: z.string().min(1).max(180),
  heroSubtitle: z.string().min(1).max(240),
  heroButtonLabel: z.string().min(1).max(80),
  heroImage: z.string().min(1).max(5_000_000)
});

const productSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(180),
  price: z.coerce.number().int().nonnegative(),
  section: z.enum(["category", "bestseller"]),
  audience: z.enum(["women", "men", "sunglasses", "unisex", "antiblue", "prescrip"]),
  ctaLabel: z.string().max(80).optional().default(""),
  description: z.string().max(400).optional().default(""),
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
  customer: z.object({
    fullName: z.string().min(1).max(120),
    phone: z.string().min(1).max(40),
    address: z.string().min(1).max(300),
    city: z.string().min(1).max(120)
  })
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

app.get("/api/storefront", (_, res) => {
  res.json(getStorefrontPayload());
});

app.get("/api/auth/me", (req, res) => {
  const user = getCurrentUserFromRequest(req);
  res.json({ user });
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid registration payload." });
    return;
  }

  const payload = parsed.data;
  const email = normalizeEmail(payload.email);

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    res.status(409).json({ error: "Email already in use." });
    return;
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  const info = db
    .prepare(
      `
        INSERT INTO users (email, password_hash, role, is_email_verified, full_name, phone, address, city)
        VALUES (?, ?, 'customer', 0, ?, ?, ?, ?)
      `
    )
    .run(email, passwordHash, payload.fullName.trim(), payload.phone.trim(), payload.address.trim(), payload.city.trim());

  const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  const verification = createVerificationToken(userRow.id);
  const delivery = await sendVerificationEmailSafe({
    toEmail: userRow.email,
    fullName: userRow.full_name,
    verificationUrl: verification.verificationUrl
  });

  res.status(201).json({
    ok: true,
    requiresEmailVerification: true,
    message: "Account created. Please verify your email before login.",
    ...(process.env.NODE_ENV !== "production" && !delivery.delivered
      ? { verificationUrl: verification.verificationUrl }
      : {})
  });
});

app.post("/api/auth/verify-email", authLimiter, (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid verification token." });
    return;
  }

  const tokenHash = hashVerificationToken(parsed.data.token);
  const tokenRow = db
    .prepare(
      `
        SELECT evt.id, evt.user_id, evt.expires_at, u.*
        FROM email_verification_tokens evt
        INNER JOIN users u ON u.id = evt.user_id
        WHERE evt.token_hash = ?
          AND evt.consumed_at IS NULL
        LIMIT 1
      `
    )
    .get(tokenHash);

  if (!tokenRow) {
    res.status(400).json({ error: "Verification link is invalid or already used." });
    return;
  }

  const expiresAtMs = Date.parse(tokenRow.expires_at);
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    db.prepare(
      `
        UPDATE email_verification_tokens
        SET consumed_at = datetime('now')
        WHERE id = ?
      `
    ).run(tokenRow.id);
    res.status(400).json({ error: "Verification link has expired. Request a new one." });
    return;
  }

  const verifyTx = db.transaction(() => {
    db.prepare(
      `
        UPDATE users
        SET is_email_verified = 1, updated_at = datetime('now')
        WHERE id = ?
      `
    ).run(tokenRow.user_id);

    db.prepare(
      `
        UPDATE email_verification_tokens
        SET consumed_at = datetime('now')
        WHERE user_id = ? AND consumed_at IS NULL
      `
    ).run(tokenRow.user_id);
  });
  verifyTx();

  const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(tokenRow.user_id);
  const user = mapUserRow(userRow);
  setAuthCookie(res, user);
  res.json({ ok: true, user, message: "Email verified successfully." });
});

app.post("/api/auth/resend-verification", authLimiter, async (req, res) => {
  const parsed = resendVerificationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const userRow = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!userRow || userRow.role !== "customer") {
    res.json({ ok: true, message: "If this account exists, a verification email has been sent." });
    return;
  }

  if (Boolean(userRow.is_email_verified)) {
    res.json({ ok: true, message: "Email is already verified." });
    return;
  }

  const verification = createVerificationToken(userRow.id);
  const delivery = await sendVerificationEmailSafe({
    toEmail: userRow.email,
    fullName: userRow.full_name,
    verificationUrl: verification.verificationUrl
  });

  res.json({
    ok: true,
    message: "Verification email sent.",
    ...(process.env.NODE_ENV !== "production" && !delivery.delivered
      ? { verificationUrl: verification.verificationUrl }
      : {})
  });
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid login payload." });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const userRow = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
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

app.patch("/api/auth/profile", requireAuth, (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile payload." });
    return;
  }

  const payload = parsed.data;
  db.prepare(
    `
      UPDATE users
      SET full_name = ?, phone = ?, address = ?, city = ?, updated_at = datetime('now')
      WHERE id = ?
    `
  ).run(payload.fullName.trim(), payload.phone.trim(), payload.address.trim(), payload.city.trim(), req.user.id);

  const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json({ user: mapUserRow(userRow) });
});

app.patch("/api/auth/password", requireAuth, async (req, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid password payload." });
    return;
  }

  const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
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
  db.prepare(
    `
      UPDATE users
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `
  ).run(nextHash, req.user.id);

  res.json({ ok: true, message: "Password updated successfully." });
});

app.get("/api/orders/my", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `
        SELECT *
        FROM orders
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
      `
    )
    .all(req.user.id);
  res.json({ orders: withOrderItems(rows) });
});

app.get("/api/orders", requireAdmin, (_, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY datetime(created_at) DESC").all();
  res.json({ orders: withOrderItems(rows) });
});

app.patch("/api/orders/:id/status", requireAdmin, (req, res) => {
  const parsed = orderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order status payload." });
    return;
  }

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) {
    res.status(404).json({ error: "Order not found." });
    return;
  }

  db.prepare(
    `
      UPDATE orders
      SET order_status = ?, updated_at = datetime('now')
      WHERE id = ?
    `
  ).run(parsed.data.orderStatus, req.params.id);

  const refreshed = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  res.json({ order: { ...mapOrderRow(refreshed), items: getOrderItems(req.params.id) } });
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
  const products = db
    .prepare(
      `SELECT * FROM products WHERE id IN (${uniqueIds.map(() => "?").join(",")})`
    )
    .all(...uniqueIds)
    .map(mapProductRow);

  const productMap = new Map(products.map((product) => [product.id, product]));

  const computedItems = payload.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) return null;
    const lineTotal = product.price * item.quantity;
    return {
      productId: product.id,
      name: product.name,
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

  const createOrderTx = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO orders (
          id, user_id, email, full_name, phone, address, city,
          payment_method, payment_reference, payment_status, subtotal
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `
    ).run(
      orderId,
      req.user.id,
      req.user.email,
      customer.fullName.trim(),
      customer.phone.trim(),
      customer.address.trim(),
      customer.city.trim(),
      payload.paymentMethod,
      reference,
      subtotal
    );

    const insertItem = db.prepare(
      `
        INSERT INTO order_items (
          order_id, product_id, name, unit_price, quantity, line_total
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `
    );
    validItems.forEach((item) => {
      insertItem.run(orderId, item.productId, item.name, item.unitPrice, item.quantity, item.lineTotal);
    });
  });

  createOrderTx();

  try {
    const channels = payload.paymentMethod === "transfer" ? ["bank_transfer", "bank"] : ["card"];
    const checkout = await initializeTransaction({
      email: req.user.email,
      amountInKobo: subtotal * 100,
      reference,
      callbackUrl: `${FRONTEND_URL}/payment/callback`,
      channels,
      metadata: {
        orderId,
        userId: req.user.id
      }
    });

    db.prepare(
      `
        UPDATE users
        SET full_name = ?, phone = ?, address = ?, city = ?, updated_at = datetime('now')
        WHERE id = ?
      `
    ).run(customer.fullName.trim(), customer.phone.trim(), customer.address.trim(), customer.city.trim(), req.user.id);

    res.json({
      orderId,
      reference,
      authorizationUrl: checkout.authorization_url,
      accessCode: checkout.access_code
    });
  } catch (error) {
    db.prepare(
      `
        UPDATE orders
        SET payment_status = 'failed', updated_at = datetime('now')
        WHERE id = ?
      `
    ).run(orderId);
    res.status(502).json({ error: error.message || "Could not initialize payment." });
  }
});

app.get("/api/checkout/verify", requireAuth, async (req, res) => {
  const reference = String(req.query.reference || "").trim();
  if (!reference) {
    res.status(400).json({ error: "Payment reference is required." });
    return;
  }

  const orderRow = db
    .prepare("SELECT * FROM orders WHERE payment_reference = ? AND user_id = ?")
    .get(reference, req.user.id);

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

    db.prepare(
      `
        UPDATE orders
        SET payment_status = ?, payment_channel = ?, updated_at = datetime('now')
        WHERE id = ?
      `
    ).run(isPaid ? "paid" : "failed", payment.channel || "", orderRow.id);

    const refreshed = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderRow.id);
    res.json({
      order: { ...mapOrderRow(refreshed), items: getOrderItems(refreshed.id) },
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

app.patch("/api/settings", requireAdmin, (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid settings payload." });
    return;
  }

  const payload = parsed.data;
  db.prepare(
    `
      UPDATE settings
      SET brand_name = ?, brand_tagline = ?, hero_title = ?, hero_subtitle = ?,
          hero_button_label = ?, hero_image = ?, updated_at = datetime('now')
      WHERE id = 1
    `
  ).run(
    payload.brandName.trim(),
    payload.brandTagline.trim(),
    payload.heroTitle.trim(),
    payload.heroSubtitle.trim(),
    payload.heroButtonLabel.trim(),
    payload.heroImage.trim()
  );

  const row = db.prepare("SELECT * FROM settings WHERE id = 1").get();
  res.json({ settings: mapSettingsRow(row) });
});

app.post("/api/products", requireAdmin, (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product payload." });
    return;
  }

  const payload = parsed.data;
  const id = payload.id || crypto.randomUUID();

  db.prepare(
    `
      INSERT INTO products (
        id, name, price, section, audience, cta_label, description, variant, image
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    id,
    payload.name.trim(),
    payload.price,
    payload.section,
    payload.audience,
    payload.ctaLabel.trim(),
    payload.description.trim(),
    payload.variant.trim() || "round",
    payload.image.trim()
  );

  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  res.status(201).json({ product: mapProductRow(row) });
});

app.put("/api/products/:id", requireAdmin, (req, res) => {
  const parsed = productSchema.safeParse({ ...req.body, id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product payload." });
    return;
  }

  const payload = parsed.data;
  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Product not found." });
    return;
  }

  db.prepare(
    `
      UPDATE products
      SET name = ?, price = ?, section = ?, audience = ?, cta_label = ?, description = ?,
          variant = ?, image = ?, updated_at = datetime('now')
      WHERE id = ?
    `
  ).run(
    payload.name.trim(),
    payload.price,
    payload.section,
    payload.audience,
    payload.ctaLabel.trim(),
    payload.description.trim(),
    payload.variant.trim() || "round",
    payload.image.trim(),
    req.params.id
  );

  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  res.json({ product: mapProductRow(row) });
});

app.delete("/api/products/:id", requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Product not found." });
    return;
  }

  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/admin/bootstrap-state", (_, res) => {
  const count = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get()?.count || 0;
  res.json({ hasAdmin: count > 0 });
});

app.get("/api/admin/customers", requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
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
        ORDER BY datetime(u.created_at) DESC
      `
    )
    .all()
    .map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name || "",
      phone: row.phone || "",
      address: row.address || "",
      city: row.city || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      orderCount: Number(row.order_count) || 0,
      totalSpent: Number(row.total_spent) || 0
    }));

  res.json({ customers: rows });
});

app.post("/api/subscriptions", authLimiter, (req, res) => {
  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const source = String(parsed.data.source || "footer").trim() || "footer";

  db.prepare(
    `
      INSERT INTO subscriptions (email, source)
      VALUES (?, ?)
      ON CONFLICT(email) DO UPDATE SET source = excluded.source
    `
  ).run(email, source);

  res.status(201).json({ ok: true, email });
});

app.get("/api/subscriptions", requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `
        SELECT id, email, source, created_at
        FROM subscriptions
        ORDER BY datetime(created_at) DESC
      `
    )
    .all()
    .map((row) => ({
      id: row.id,
      email: row.email,
      source: row.source,
      createdAt: row.created_at
    }));

  res.json({ subscriptions: rows });
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

bootstrapAdminIfConfigured()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`API server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to bootstrap admin account:", error);
    process.exit(1);
  });
