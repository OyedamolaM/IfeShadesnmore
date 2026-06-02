import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import pg from "pg";
import {
  DEFAULT_FEATURE_ITEMS,
  DEFAULT_HERO_PROMISE_ITEMS,
  DEFAULT_PRODUCT_DETAIL_BULLETS,
  DEFAULT_PRODUCTS,
  DEFAULT_SETTINGS
} from "./defaults.js";

const { Pool } = pg;

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const USE_POSTGRES = Boolean(DATABASE_URL);
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.NOW_REGION);

const DEFAULT_SQLITE_DATA_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), "ife-shadesnmore")
  : path.join(process.cwd(), "server", "data");
const configuredSqlitePath = String(process.env.DB_PATH || "").trim();
const SQLITE_DB_PATH = configuredSqlitePath
  ? path.resolve(configuredSqlitePath)
  : path.join(DEFAULT_SQLITE_DATA_DIR, "ife-store.db");
const SQLITE_DATA_DIR = path.dirname(SQLITE_DB_PATH);

let sqliteDb = null;
let pgPool = null;

if (USE_POSTGRES) {
  const disableSsl = String(process.env.PG_DISABLE_SSL || "")
    .trim()
    .toLowerCase();
  const shouldDisableSsl = disableSsl === "true" || disableSsl === "1";
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: shouldDisableSsl ? false : { rejectUnauthorized: false }
  });
} else {
  if (!fs.existsSync(SQLITE_DATA_DIR)) {
    fs.mkdirSync(SQLITE_DATA_DIR, { recursive: true });
  }
  sqliteDb = new Database(SQLITE_DB_PATH);
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.pragma("foreign_keys = ON");
}

export const databaseDriver = USE_POSTGRES ? "postgres" : "sqlite";

const PRODUCT_AUDIENCE_VALUES = new Set([
  "women",
  "men",
  "sunglasses",
  "unisex",
  "antiblue",
  "prescrip"
]);
const PRODUCT_AVAILABILITY_VALUES = new Set(["in_stock", "out_of_stock", "preorder"]);
const BULLET_ICON_TYPES = new Set(["shipping", "arrivals", "quality", "returns"]);

function normalizeSqlForPostgres(sql) {
  let normalized = String(sql || "");
  normalized = normalized.replace(/datetime\('now'\)/gi, "CURRENT_TIMESTAMP");
  normalized = normalized.replace(/datetime\(([^)]+)\)/gi, "$1");

  let index = 0;
  normalized = normalized.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
  return normalized;
}

async function pgQuery(sql, params = [], client = null) {
  const target = client || pgPool;
  const text = normalizeSqlForPostgres(sql);
  return target.query(text, params);
}

function sqliteQueryOne(sql, params = []) {
  return sqliteDb.prepare(sql).get(...params);
}

function sqliteQueryAll(sql, params = []) {
  return sqliteDb.prepare(sql).all(...params);
}

function sqliteExecute(sql, params = []) {
  const info = sqliteDb.prepare(sql).run(...params);
  return {
    rowCount: Number(info.changes) || 0,
    lastInsertRowid: info.lastInsertRowid || null
  };
}

export async function queryOne(sql, params = [], client = null) {
  if (!USE_POSTGRES) return sqliteQueryOne(sql, params);
  const result = await pgQuery(sql, params, client);
  return result.rows[0] || null;
}

export async function queryAll(sql, params = [], client = null) {
  if (!USE_POSTGRES) return sqliteQueryAll(sql, params);
  const result = await pgQuery(sql, params, client);
  return result.rows || [];
}

export async function execute(sql, params = [], client = null) {
  if (!USE_POSTGRES) return sqliteExecute(sql, params);
  const result = await pgQuery(sql, params, client);
  return {
    rowCount: Number(result.rowCount) || 0,
    rows: result.rows || [],
    lastInsertRowid: result.rows?.[0]?.id || null
  };
}

export async function withTransaction(work) {
  if (!USE_POSTGRES) {
    sqliteDb.exec("BEGIN");
    try {
      const result = await work({
        queryOne: (sql, params = []) => queryOne(sql, params),
        queryAll: (sql, params = []) => queryAll(sql, params),
        execute: (sql, params = []) => execute(sql, params)
      });
      sqliteDb.exec("COMMIT");
      return result;
    } catch (error) {
      sqliteDb.exec("ROLLBACK");
      throw error;
    }
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const result = await work({
      queryOne: (sql, params = []) => queryOne(sql, params, client),
      queryAll: (sql, params = []) => queryAll(sql, params, client),
      execute: (sql, params = []) => execute(sql, params, client)
    });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function normalizeProductAudience(value) {
  const source = String(value || "").trim().toLowerCase();
  if (!source) return "unisex";
  if (PRODUCT_AUDIENCE_VALUES.has(source)) return source;

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

function normalizeProductAvailability(value) {
  const source = String(value || "").trim().toLowerCase();
  if (!source) return "in_stock";
  if (PRODUCT_AVAILABILITY_VALUES.has(source)) return source;

  const compact = source.replace(/[^a-z]/g, "");
  if (compact === "instock" || compact === "available") return "in_stock";
  if (compact === "outofstock" || compact === "soldout" || compact === "unavailable") {
    return "out_of_stock";
  }
  if (compact === "preorder" || compact === "preorderonly" || compact === "comingsoon") {
    return "preorder";
  }
  return "in_stock";
}

function parseAudienceList(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
  const normalized = source.map(normalizeProductAudience);
  const unique = [...new Set(normalized.filter(Boolean))];
  return unique.length > 0 ? unique : ["unisex"];
}

function serializeAudienceList(value) {
  return parseAudienceList(value).join(",");
}

function parseProductDetailBullets(value, fallback = DEFAULT_PRODUCT_DETAIL_BULLETS) {
  const fallbackArray = Array.isArray(fallback) ? fallback : DEFAULT_PRODUCT_DETAIL_BULLETS;
  if (!value) return fallbackArray;

  let parsed;
  try {
    parsed = JSON.parse(String(value));
  } catch {
    return fallbackArray;
  }

  if (!Array.isArray(parsed)) return fallbackArray;

  const normalized = parsed
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  return normalized.length > 0 ? normalized : fallbackArray;
}

function serializeProductDetailBullets(value) {
  const source = Array.isArray(value) ? value : [];
  const normalized = source
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  return JSON.stringify(normalized.length > 0 ? normalized : DEFAULT_PRODUCT_DETAIL_BULLETS);
}

function normalizePreorderNote(value) {
  return String(value || "").trim().slice(0, 180);
}

function parseSettingsItems(value, fallback) {
  const fallbackArray = Array.isArray(fallback) ? fallback : [];
  if (!value) return fallbackArray;

  let parsed;
  try {
    parsed = JSON.parse(String(value));
  } catch {
    return fallbackArray;
  }
  if (!Array.isArray(parsed)) return fallbackArray;

  const normalized = parsed
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const type = String(item.type || "").trim().toLowerCase();
      const title = String(item.title || "").trim();
      const description = String(item.description || "").trim();
      if (!BULLET_ICON_TYPES.has(type)) return null;
      if (!title) return null;
      return { type, title, description };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : fallbackArray;
}

async function runMigrationsSqlite() {
  sqliteDb.exec(`
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
      hero_kicker TEXT DEFAULT '',
      hero_title TEXT NOT NULL,
      hero_subtitle TEXT NOT NULL,
      hero_button_label TEXT NOT NULL,
      hero_image TEXT NOT NULL,
      hero_promise_items TEXT DEFAULT '[]',
      feature_items TEXT DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      section TEXT NOT NULL DEFAULT 'category',
      audience TEXT NOT NULL DEFAULT 'unisex',
      availability TEXT NOT NULL DEFAULT 'in_stock',
      preorder_note TEXT DEFAULT '',
      cta_label TEXT DEFAULT '',
      description TEXT DEFAULT '',
      detail_bullets TEXT DEFAULT '[]',
      variant TEXT DEFAULT 'round',
      image TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blogs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      excerpt TEXT DEFAULT '',
      content TEXT NOT NULL,
      image TEXT DEFAULT '',
      author TEXT DEFAULT '',
      is_published INTEGER NOT NULL DEFAULT 1,
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
      admin_notified_at TEXT DEFAULT NULL,
      customer_notified_at TEXT DEFAULT NULL,
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
      availability TEXT NOT NULL DEFAULT 'in_stock',
      preorder_note TEXT DEFAULT '',
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

  const orderColumns = sqliteDb.prepare("PRAGMA table_info(orders)").all();
  if (!orderColumns.some((column) => column.name === "order_status")) {
    sqliteDb.exec(`ALTER TABLE orders ADD COLUMN order_status TEXT NOT NULL DEFAULT 'pending'`);
  }
  if (!orderColumns.some((column) => column.name === "admin_notified_at")) {
    sqliteDb.exec(`ALTER TABLE orders ADD COLUMN admin_notified_at TEXT DEFAULT NULL`);
  }
  if (!orderColumns.some((column) => column.name === "customer_notified_at")) {
    sqliteDb.exec(`ALTER TABLE orders ADD COLUMN customer_notified_at TEXT DEFAULT NULL`);
  }

  const userColumns = sqliteDb.prepare("PRAGMA table_info(users)").all();
  if (!userColumns.some((column) => column.name === "is_email_verified")) {
    sqliteDb.exec(`ALTER TABLE users ADD COLUMN is_email_verified INTEGER NOT NULL DEFAULT 1`);
  }

  const settingsColumns = sqliteDb.prepare("PRAGMA table_info(settings)").all();
  if (!settingsColumns.some((column) => column.name === "hero_promise_items")) {
    sqliteDb.exec(`ALTER TABLE settings ADD COLUMN hero_promise_items TEXT DEFAULT '[]'`);
  }
  if (!settingsColumns.some((column) => column.name === "hero_kicker")) {
    sqliteDb.exec(`ALTER TABLE settings ADD COLUMN hero_kicker TEXT DEFAULT ''`);
  }
  if (!settingsColumns.some((column) => column.name === "feature_items")) {
    sqliteDb.exec(`ALTER TABLE settings ADD COLUMN feature_items TEXT DEFAULT '[]'`);
  }

  const productColumns = sqliteDb.prepare("PRAGMA table_info(products)").all();
  if (!productColumns.some((column) => column.name === "availability")) {
    sqliteDb.exec(`ALTER TABLE products ADD COLUMN availability TEXT NOT NULL DEFAULT 'in_stock'`);
  }
  if (!productColumns.some((column) => column.name === "preorder_note")) {
    sqliteDb.exec(`ALTER TABLE products ADD COLUMN preorder_note TEXT DEFAULT ''`);
  }
  if (!productColumns.some((column) => column.name === "detail_bullets")) {
    sqliteDb.exec(`ALTER TABLE products ADD COLUMN detail_bullets TEXT DEFAULT '[]'`);
  }

  const orderItemColumns = sqliteDb.prepare("PRAGMA table_info(order_items)").all();
  if (!orderItemColumns.some((column) => column.name === "availability")) {
    sqliteDb.exec(`ALTER TABLE order_items ADD COLUMN availability TEXT NOT NULL DEFAULT 'in_stock'`);
  }
  if (!orderItemColumns.some((column) => column.name === "preorder_note")) {
    sqliteDb.exec(`ALTER TABLE order_items ADD COLUMN preorder_note TEXT DEFAULT ''`);
  }

  const blogColumns = sqliteDb.prepare("PRAGMA table_info(blogs)").all();
  if (!blogColumns.some((column) => column.name === "image")) {
    sqliteDb.exec(`ALTER TABLE blogs ADD COLUMN image TEXT DEFAULT ''`);
  }
  if (!blogColumns.some((column) => column.name === "author")) {
    sqliteDb.exec(`ALTER TABLE blogs ADD COLUMN author TEXT DEFAULT ''`);
  }
  if (!blogColumns.some((column) => column.name === "is_published")) {
    sqliteDb.exec(`ALTER TABLE blogs ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1`);
  }
}

async function runMigrationsPostgres() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('admin','customer')),
      is_email_verified BOOLEAN NOT NULL DEFAULT TRUE,
      full_name TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id SMALLINT PRIMARY KEY,
      brand_name TEXT NOT NULL,
      brand_tagline TEXT NOT NULL,
      hero_kicker TEXT DEFAULT '',
      hero_title TEXT NOT NULL,
      hero_subtitle TEXT NOT NULL,
      hero_button_label TEXT NOT NULL,
      hero_image TEXT NOT NULL,
      hero_promise_items TEXT DEFAULT '[]',
      feature_items TEXT DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      section TEXT NOT NULL DEFAULT 'category',
      audience TEXT NOT NULL DEFAULT 'unisex',
      availability TEXT NOT NULL DEFAULT 'in_stock',
      preorder_note TEXT DEFAULT '',
      cta_label TEXT DEFAULT '',
      description TEXT DEFAULT '',
      detail_bullets TEXT DEFAULT '[]',
      variant TEXT DEFAULT 'round',
      image TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blogs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      excerpt TEXT DEFAULT '',
      content TEXT NOT NULL,
      image TEXT DEFAULT '',
      author TEXT DEFAULT '',
      is_published BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('card','transfer')),
      payment_reference TEXT NOT NULL UNIQUE,
      payment_channel TEXT DEFAULT '',
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','failed','cancelled')),
      order_status TEXT NOT NULL DEFAULT 'pending',
      admin_notified_at TIMESTAMPTZ DEFAULT NULL,
      customer_notified_at TIMESTAMPTZ DEFAULT NULL,
      subtotal INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NGN',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      availability TEXT NOT NULL DEFAULT 'in_stock',
      preorder_note TEXT DEFAULT '',
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      line_total INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL DEFAULT 'footer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ DEFAULT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pgPool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT TRUE;`);
  await pgPool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'pending';`);
  await pgPool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ DEFAULT NULL;`);
  await pgPool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_notified_at TIMESTAMPTZ DEFAULT NULL;`);
  await pgPool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_promise_items TEXT DEFAULT '[]';`);
  await pgPool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_kicker TEXT DEFAULT '';`);
  await pgPool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS feature_items TEXT DEFAULT '[]';`);
  await pgPool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS availability TEXT NOT NULL DEFAULT 'in_stock';`);
  await pgPool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_note TEXT DEFAULT '';`);
  await pgPool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS detail_bullets TEXT DEFAULT '[]';`);
  await pgPool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS availability TEXT NOT NULL DEFAULT 'in_stock';`);
  await pgPool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS preorder_note TEXT DEFAULT '';`);
  await pgPool.query(`ALTER TABLE blogs ADD COLUMN IF NOT EXISTS image TEXT DEFAULT '';`);
  await pgPool.query(`ALTER TABLE blogs ADD COLUMN IF NOT EXISTS author TEXT DEFAULT '';`);
  await pgPool.query(`ALTER TABLE blogs ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;`);
}

async function seedSettingsIfEmpty() {
  const existing = await queryOne("SELECT id FROM settings WHERE id = 1");
  if (existing) return;

  await execute(
    `
      INSERT INTO settings (
        id, brand_name, brand_tagline, hero_kicker, hero_title, hero_subtitle, hero_button_label, hero_image,
        hero_promise_items, feature_items
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      1,
      DEFAULT_SETTINGS.brandName,
      DEFAULT_SETTINGS.brandTagline,
      DEFAULT_SETTINGS.heroKicker || "",
      DEFAULT_SETTINGS.heroTitle,
      DEFAULT_SETTINGS.heroSubtitle,
      DEFAULT_SETTINGS.heroButtonLabel,
      DEFAULT_SETTINGS.heroImage,
      JSON.stringify(DEFAULT_SETTINGS.heroPromiseItems || DEFAULT_HERO_PROMISE_ITEMS),
      JSON.stringify(DEFAULT_SETTINGS.featureItems || DEFAULT_FEATURE_ITEMS)
    ]
  );
}

async function seedProductsIfEmpty() {
  const shouldSeedDefaults =
    IS_VERCEL ||
    String(process.env.SEED_DEFAULT_PRODUCTS || "")
      .trim()
      .toLowerCase() === "true";
  if (!shouldSeedDefaults) return;

  const countRow = await queryOne("SELECT COUNT(*) AS count FROM products");
  if ((Number(countRow?.count) || 0) > 0) return;

  for (const item of DEFAULT_PRODUCTS) {
    await execute(
      `
        INSERT INTO products (
          id, name, price, section, audience, availability, preorder_note, cta_label, description, detail_bullets, variant, image
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        item.id,
        item.name,
        item.price,
        item.section,
        serializeAudienceList(item.audiences || item.audience),
        normalizeProductAvailability(item.availability),
        normalizePreorderNote(item.preorderNote),
        item.ctaLabel || "",
        item.description || "",
        serializeProductDetailBullets(item.detailBullets),
        item.variant || "round",
        item.image || ""
      ]
    );
  }
}

async function backfillSunglassesAudience() {
  await execute(
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
  );
}

export async function initDatabase() {
  if (USE_POSTGRES) {
    await runMigrationsPostgres();
  } else {
    await runMigrationsSqlite();
  }
  await seedSettingsIfEmpty();
  await seedProductsIfEmpty();
  await backfillSunglassesAudience();
}

export async function closeDatabase() {
  if (USE_POSTGRES && pgPool) {
    await pgPool.end();
  }
  if (!USE_POSTGRES && sqliteDb) {
    sqliteDb.close();
  }
}

export function mapProductRow(row) {
  const audiences = parseAudienceList(row.audience);
  const availability = normalizeProductAvailability(row.availability);
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price) || 0,
    section: row.section,
    audience: audiences[0],
    audiences,
    availability,
    preorderNote: availability === "preorder" ? normalizePreorderNote(row.preorder_note) : "",
    ctaLabel: row.cta_label || "",
    description: row.description || "",
    detailBullets: parseProductDetailBullets(row.detail_bullets),
    variant: row.variant || "round",
    image: row.image || ""
  };
}

export function mapBlogRow(row) {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt || "",
    content: row.content || "",
    image: row.image || "",
    author: row.author || "",
    isPublished: Boolean(row.is_published),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapSettingsRow(row) {
  return {
    brandName: row.brand_name,
    brandTagline: row.brand_tagline,
    heroKicker: row.hero_kicker || "",
    heroTitle: row.hero_title,
    heroSubtitle: row.hero_subtitle,
    heroButtonLabel: row.hero_button_label,
    heroImage: row.hero_image,
    heroPromiseItems: parseSettingsItems(row.hero_promise_items, DEFAULT_HERO_PROMISE_ITEMS),
    featureItems: parseSettingsItems(row.feature_items, DEFAULT_FEATURE_ITEMS)
  };
}

export function mapUserRow(row) {
  return {
    id: Number(row.id),
    email: row.email,
    role: row.role,
    isEmailVerified: Boolean(row.is_email_verified),
    fullName: row.full_name || "",
    phone: row.phone || "",
    address: row.address || "",
    city: row.city || ""
  };
}
