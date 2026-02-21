import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from "./defaults.js";

const DATA_DIR = path.join(process.cwd(), "server", "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "ife-store.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','customer')) DEFAULT 'customer',
      is_email_verified INTEGER NOT NULL DEFAULT 1,
      full_name TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      brand_name TEXT NOT NULL,
      brand_tagline TEXT NOT NULL,
      hero_title TEXT NOT NULL,
      hero_subtitle TEXT NOT NULL,
      hero_button_label TEXT NOT NULL,
      hero_image TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      section TEXT NOT NULL DEFAULT 'category',
      audience TEXT NOT NULL DEFAULT 'unisex',
      cta_label TEXT DEFAULT '',
      description TEXT DEFAULT '',
      variant TEXT DEFAULT 'round',
      image TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('card','transfer')),
      payment_reference TEXT NOT NULL UNIQUE,
      payment_channel TEXT DEFAULT '',
      payment_status TEXT NOT NULL CHECK(payment_status IN ('pending','paid','failed','cancelled')) DEFAULT 'pending',
      order_status TEXT NOT NULL DEFAULT 'pending',
      subtotal INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NGN',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      line_total INTEGER NOT NULL,
        FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL DEFAULT 'footer',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      consumed_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

function hasColumn(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

function runAlterMigrations() {
  if (!hasColumn("orders", "order_status")) {
    db.exec(`ALTER TABLE orders ADD COLUMN order_status TEXT NOT NULL DEFAULT 'pending'`);
  }

  if (!hasColumn("users", "is_email_verified")) {
    db.exec(`ALTER TABLE users ADD COLUMN is_email_verified INTEGER NOT NULL DEFAULT 1`);
  }
}

function seedSettingsIfEmpty() {
  const existing = db.prepare("SELECT id FROM settings WHERE id = 1").get();
  if (existing) return;

  db.prepare(
    `
      INSERT INTO settings (
        id, brand_name, brand_tagline, hero_title, hero_subtitle, hero_button_label, hero_image
      )
      VALUES (
        1, @brandName, @brandTagline, @heroTitle, @heroSubtitle, @heroButtonLabel, @heroImage
      )
    `
  ).run(DEFAULT_SETTINGS);
}

function seedProductsIfEmpty() {
  const shouldSeedDefaults =
    String(process.env.SEED_DEFAULT_PRODUCTS || "")
      .trim()
      .toLowerCase() === "true";
  if (!shouldSeedDefaults) return;

  const countRow = db.prepare("SELECT COUNT(*) AS count FROM products").get();
  if ((countRow?.count || 0) > 0) return;

  const insert = db.prepare(`
    INSERT INTO products (
      id, name, price, section, audience, cta_label, description, variant, image
    )
    VALUES (
      @id, @name, @price, @section, @audience, @ctaLabel, @description, @variant, @image
    )
  `);
  const insertMany = db.transaction((items) => {
    items.forEach((item) =>
      insert.run({
        ...item,
        ctaLabel: item.ctaLabel || ""
      })
    );
  });
  insertMany(DEFAULT_PRODUCTS);
}

function backfillSunglassesAudience() {
  db.prepare(
    `
      UPDATE products
      SET
        audience = 'sunglasses',
        updated_at = datetime('now')
      WHERE
        lower(trim(audience)) IN ('sunglass', 'shades')
        OR (
          lower(trim(audience)) = 'unisex'
          AND (
            lower(name) LIKE '%sunglass%'
            OR lower(name) LIKE '%shades%'
            OR lower(id) LIKE '%sunglass%'
            OR lower(id) LIKE '%shades%'
          )
        )
    `
  ).run();
}

export function mapProductRow(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price) || 0,
    section: row.section,
    audience: row.audience,
    ctaLabel: row.cta_label || "",
    description: row.description || "",
    variant: row.variant || "round",
    image: row.image || ""
  };
}

export function mapSettingsRow(row) {
  return {
    brandName: row.brand_name,
    brandTagline: row.brand_tagline,
    heroTitle: row.hero_title,
    heroSubtitle: row.hero_subtitle,
    heroButtonLabel: row.hero_button_label,
    heroImage: row.hero_image
  };
}

export function mapUserRow(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isEmailVerified: Boolean(row.is_email_verified),
    fullName: row.full_name || "",
    phone: row.phone || "",
    address: row.address || "",
    city: row.city || ""
  };
}

runMigrations();
runAlterMigrations();
seedSettingsIfEmpty();
seedProductsIfEmpty();
backfillSunglassesAudience();
