import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const SQLITE_PATH = String(
  process.env.SQLITE_MIGRATION_SOURCE ||
    process.env.DB_PATH ||
    path.join(process.cwd(), "server", "data", "ife-store.db")
).trim();

function parseBoolean(value, fallback = false) {
  const text = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(text)) return true;
  if (["false", "0", "no", "off"].includes(text)) return false;
  return fallback;
}

function toIsoOrNull(value) {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  return String(value);
}

function sqliteRows(db, sql, params = []) {
  return db.prepare(sql).all(...params);
}

async function setSequence(client, table, column) {
  await client.query(
    `
      SELECT setval(
        pg_get_serial_sequence($1, $2),
        COALESCE((SELECT MAX(${column}) FROM ${table}), 0) + 1,
        false
      )
    `,
    [table, column]
  );
}

async function ensurePostgresSchema(client) {
  await client.query(`
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
      hero_title TEXT NOT NULL,
      hero_subtitle TEXT NOT NULL,
      hero_button_label TEXT NOT NULL,
      hero_image TEXT NOT NULL,
      hero_promise_items TEXT DEFAULT '[]',
      feature_items TEXT DEFAULT '[]',
      shipping_tiers TEXT DEFAULT '[]',
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
      order_status TEXT NOT NULL DEFAULT 'processing',
      admin_notified_at TIMESTAMPTZ DEFAULT NULL,
      customer_notified_at TIMESTAMPTZ DEFAULT NULL,
      shipping_tier_id TEXT DEFAULT '',
      shipping_tier_name TEXT DEFAULT '',
      shipping_fee INTEGER NOT NULL DEFAULT 0,
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

  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT TRUE;`);
  await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'processing';`);
  await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ DEFAULT NULL;`);
  await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_notified_at TIMESTAMPTZ DEFAULT NULL;`);
  await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_tier_id TEXT DEFAULT '';`);
  await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_tier_name TEXT DEFAULT '';`);
  await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee INTEGER NOT NULL DEFAULT 0;`);
  await client.query(`
    UPDATE orders
    SET order_status = 'processing'
    WHERE order_status IN ('pending', 'failed');
  `);
  await client.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_promise_items TEXT DEFAULT '[]';`);
  await client.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS feature_items TEXT DEFAULT '[]';`);
  await client.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS shipping_tiers TEXT DEFAULT '[]';`);
  await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS availability TEXT NOT NULL DEFAULT 'in_stock';`);
  await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_note TEXT DEFAULT '';`);
  await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS detail_bullets TEXT DEFAULT '[]';`);
  await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS availability TEXT NOT NULL DEFAULT 'in_stock';`);
  await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS preorder_note TEXT DEFAULT '';`);
}

async function main() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  if (!fs.existsSync(SQLITE_PATH)) {
    throw new Error(`SQLite source not found: ${SQLITE_PATH}`);
  }

  const disableSsl = parseBoolean(process.env.PG_DISABLE_SSL, false);
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: disableSsl ? false : { rejectUnauthorized: false }
  });
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  const users = sqliteRows(sqlite, "SELECT * FROM users ORDER BY id ASC");
  const settings = sqliteRows(sqlite, "SELECT * FROM settings ORDER BY id ASC");
  const products = sqliteRows(sqlite, "SELECT * FROM products ORDER BY created_at ASC");
  const orders = sqliteRows(sqlite, "SELECT * FROM orders ORDER BY created_at ASC");
  const orderItems = sqliteRows(sqlite, "SELECT * FROM order_items ORDER BY id ASC");
  const subscriptions = sqliteRows(sqlite, "SELECT * FROM subscriptions ORDER BY id ASC");
  const verificationTokens = sqliteRows(
    sqlite,
    "SELECT * FROM email_verification_tokens ORDER BY id ASC"
  );

  const client = await pool.connect();
  try {
    await ensurePostgresSchema(client);
    await client.query("BEGIN");

    for (const row of users) {
      await client.query(
        `
          INSERT INTO users (
            id, email, password_hash, role, is_email_verified, full_name, phone, address, city, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, CURRENT_TIMESTAMP), COALESCE($11::timestamptz, CURRENT_TIMESTAMP))
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            is_email_verified = EXCLUDED.is_email_verified,
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            updated_at = EXCLUDED.updated_at
        `,
        [
          Number(row.id),
          row.email,
          row.password_hash,
          row.role,
          Boolean(row.is_email_verified),
          row.full_name || "",
          row.phone || "",
          row.address || "",
          row.city || "",
          toIsoOrNull(row.created_at),
          toIsoOrNull(row.updated_at)
        ]
      );
    }

    for (const row of settings) {
      await client.query(
        `
          INSERT INTO settings (
            id, brand_name, brand_tagline, hero_title, hero_subtitle, hero_button_label, hero_image,
            hero_promise_items, feature_items, shipping_tiers, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamptz, CURRENT_TIMESTAMP))
          ON CONFLICT (id) DO UPDATE SET
            brand_name = EXCLUDED.brand_name,
            brand_tagline = EXCLUDED.brand_tagline,
            hero_title = EXCLUDED.hero_title,
            hero_subtitle = EXCLUDED.hero_subtitle,
            hero_button_label = EXCLUDED.hero_button_label,
            hero_image = EXCLUDED.hero_image,
            hero_promise_items = EXCLUDED.hero_promise_items,
            feature_items = EXCLUDED.feature_items,
            shipping_tiers = EXCLUDED.shipping_tiers,
            updated_at = EXCLUDED.updated_at
        `,
        [
          Number(row.id),
          row.brand_name,
          row.brand_tagline,
          row.hero_title,
          row.hero_subtitle,
          row.hero_button_label,
          row.hero_image,
          row.hero_promise_items || "[]",
          row.feature_items || "[]",
          row.shipping_tiers || "[]",
          toIsoOrNull(row.updated_at)
        ]
      );
    }

    for (const row of products) {
      await client.query(
        `
          INSERT INTO products (
            id, name, price, section, audience, availability, preorder_note, cta_label, description, detail_bullets, variant, image, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::timestamptz, CURRENT_TIMESTAMP), COALESCE($14::timestamptz, CURRENT_TIMESTAMP))
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            price = EXCLUDED.price,
            section = EXCLUDED.section,
            audience = EXCLUDED.audience,
            availability = EXCLUDED.availability,
            preorder_note = EXCLUDED.preorder_note,
            cta_label = EXCLUDED.cta_label,
            description = EXCLUDED.description,
            detail_bullets = EXCLUDED.detail_bullets,
            variant = EXCLUDED.variant,
            image = EXCLUDED.image,
            updated_at = EXCLUDED.updated_at
        `,
        [
          row.id,
          row.name,
          Number(row.price) || 0,
          row.section || "category",
          row.audience || "unisex",
          row.availability || "in_stock",
          row.preorder_note || "",
          row.cta_label || "",
          row.description || "",
          row.detail_bullets || "[]",
          row.variant || "round",
          row.image || "",
          toIsoOrNull(row.created_at),
          toIsoOrNull(row.updated_at)
        ]
      );
    }

    for (const row of orders) {
      await client.query(
        `
          INSERT INTO orders (
            id, user_id, email, full_name, phone, address, city, payment_method, payment_reference, payment_channel, payment_status, order_status, admin_notified_at, customer_notified_at, shipping_tier_id, shipping_tier_name, shipping_fee, subtotal, currency, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::timestamptz, $15, $16, $17, $18, $19, COALESCE($20::timestamptz, CURRENT_TIMESTAMP), COALESCE($21::timestamptz, CURRENT_TIMESTAMP))
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            payment_method = EXCLUDED.payment_method,
            payment_reference = EXCLUDED.payment_reference,
            payment_channel = EXCLUDED.payment_channel,
            payment_status = EXCLUDED.payment_status,
            order_status = EXCLUDED.order_status,
            admin_notified_at = EXCLUDED.admin_notified_at,
            customer_notified_at = EXCLUDED.customer_notified_at,
            shipping_tier_id = EXCLUDED.shipping_tier_id,
            shipping_tier_name = EXCLUDED.shipping_tier_name,
            shipping_fee = EXCLUDED.shipping_fee,
            subtotal = EXCLUDED.subtotal,
            currency = EXCLUDED.currency,
            updated_at = EXCLUDED.updated_at
        `,
        [
          row.id,
          Number(row.user_id),
          row.email,
          row.full_name,
          row.phone,
          row.address,
          row.city,
          row.payment_method,
          row.payment_reference,
          row.payment_channel || "",
          row.payment_status || "pending",
          ["pending", "failed"].includes(row.order_status) ? "processing" : row.order_status || "processing",
          toIsoOrNull(row.admin_notified_at),
          toIsoOrNull(row.customer_notified_at),
          row.shipping_tier_id || "",
          row.shipping_tier_name || "",
          Number(row.shipping_fee) || 0,
          Number(row.subtotal) || 0,
          row.currency || "NGN",
          toIsoOrNull(row.created_at),
          toIsoOrNull(row.updated_at)
        ]
      );
    }

    for (const row of orderItems) {
      await client.query(
        `
          INSERT INTO order_items (
            id, order_id, product_id, name, availability, preorder_note, unit_price, quantity, line_total
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            order_id = EXCLUDED.order_id,
            product_id = EXCLUDED.product_id,
            name = EXCLUDED.name,
            availability = EXCLUDED.availability,
            preorder_note = EXCLUDED.preorder_note,
            unit_price = EXCLUDED.unit_price,
            quantity = EXCLUDED.quantity,
            line_total = EXCLUDED.line_total
        `,
        [
          Number(row.id),
          row.order_id,
          row.product_id,
          row.name,
          row.availability || "in_stock",
          row.preorder_note || "",
          Number(row.unit_price) || 0,
          Number(row.quantity) || 0,
          Number(row.line_total) || 0
        ]
      );
    }

    for (const row of subscriptions) {
      await client.query(
        `
          INSERT INTO subscriptions (
            id, email, source, created_at
          )
          VALUES ($1, $2, $3, COALESCE($4::timestamptz, CURRENT_TIMESTAMP))
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            source = EXCLUDED.source,
            created_at = EXCLUDED.created_at
        `,
        [Number(row.id), row.email, row.source || "footer", toIsoOrNull(row.created_at)]
      );
    }

    for (const row of verificationTokens) {
      await client.query(
        `
          INSERT INTO email_verification_tokens (
            id, user_id, token_hash, expires_at, consumed_at, created_at
          )
          VALUES (
            $1, $2, $3,
            COALESCE($4::timestamptz, CURRENT_TIMESTAMP),
            $5::timestamptz,
            COALESCE($6::timestamptz, CURRENT_TIMESTAMP)
          )
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            token_hash = EXCLUDED.token_hash,
            expires_at = EXCLUDED.expires_at,
            consumed_at = EXCLUDED.consumed_at,
            created_at = EXCLUDED.created_at
        `,
        [
          Number(row.id),
          Number(row.user_id),
          row.token_hash,
          toIsoOrNull(row.expires_at),
          toIsoOrNull(row.consumed_at),
          toIsoOrNull(row.created_at)
        ]
      );
    }

    await setSequence(client, "users", "id");
    await setSequence(client, "order_items", "id");
    await setSequence(client, "subscriptions", "id");
    await setSequence(client, "email_verification_tokens", "id");

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          ok: true,
          source: SQLITE_PATH,
          counts: {
            users: users.length,
            settings: settings.length,
            products: products.length,
            orders: orders.length,
            orderItems: orderItems.length,
            subscriptions: subscriptions.length,
            verificationTokens: verificationTokens.length
          }
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    sqlite.close();
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error.message || error);
  process.exit(1);
});
