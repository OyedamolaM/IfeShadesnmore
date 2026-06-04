import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const { execute, queryAll } = await import("../server/db.js");

const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const bucket = String(process.env.SUPABASE_STORAGE_BUCKET || "ife-shadesnmore").trim();
const folder = String(process.env.SUPABASE_STORAGE_FOLDER || "uploads").trim().replace(/^\/+|\/+$/g, "") || "uploads";
const publicRoot = path.join(process.cwd(), "public");

if (!supabaseUrl || !serviceRoleKey || !bucket) {
  throw new Error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET before running this migration.");
}

async function ensureBucket() {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
    headers: storageHeaders()
  });
  if (response.ok) return;

  const createResponse = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      ...storageHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id: bucket, name: bucket, public: true })
  });

  if (!createResponse.ok && createResponse.status !== 409) {
    throw new Error(`Could not create storage bucket (${createResponse.status}): ${await createResponse.text()}`);
  }
}

function storageHeaders() {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };
}

function publicStorageUrl(objectPath) {
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function contentTypeFor(fileName, fallback = "image/jpeg") {
  const ext = String(fileName || "").split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return fallback;
}

function extensionForMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("svg")) return "svg";
  return "jpg";
}

function sanitizeObjectName(value, fallback) {
  const source = String(value || fallback || "image").trim().toLowerCase();
  const cleaned = source
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const ext = source.includes(".") ? source.split(".").pop().replace(/[^a-z0-9]/g, "") : "";
  return `${cleaned || fallback || "image"}${ext ? `.${ext}` : ""}`;
}

async function uploadBuffer(buffer, objectPath, contentType) {
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      ...storageHeaders(),
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body: buffer
  });

  if (!response.ok) {
    throw new Error(`Could not upload ${objectPath} (${response.status}): ${await response.text()}`);
  }
}

function readImagePayload(row, tableName) {
  const image = String(row.image || "").trim();
  if (!image) return null;
  if (image.startsWith(`${supabaseUrl}/storage/v1/object/public/`)) return null;
  if (/^https?:\/\//i.test(image)) return null;

  if (image.startsWith("/")) {
    const relativePath = image.replace(/^\/+/, "");
    const diskPath = path.join(publicRoot, relativePath);
    if (!fs.existsSync(diskPath)) {
      return { status: "skipped", reason: "local file missing" };
    }
    const fileName = sanitizeObjectName(path.basename(diskPath), `${tableName}-${row.id}.jpg`);
    return {
      buffer: fs.readFileSync(diskPath),
      contentType: contentTypeFor(fileName),
      fileName
    };
  }

  const dataUrlMatch = image.match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/i);
  if (dataUrlMatch) {
    const contentType = dataUrlMatch[1] || "image/jpeg";
    const ext = extensionForMime(contentType);
    return {
      buffer: Buffer.from(dataUrlMatch[2], "base64"),
      contentType,
      fileName: sanitizeObjectName(`${tableName}-${row.id}.${ext}`)
    };
  }

  return { status: "skipped", reason: "unsupported image value" };
}

async function migrateTable({ tableName, objectFolder, labelColumn = "name" }) {
  const rows = await queryAll(
    `SELECT id, ${labelColumn}, image FROM ${tableName} WHERE coalesce(image, '') <> '' ORDER BY created_at DESC`
  );
  const migrated = [];

  for (const row of rows) {
    const payload = readImagePayload(row, tableName);
    if (!payload) {
      migrated.push({ id: row.id, status: "skipped", reason: "already remote or empty" });
      continue;
    }
    if (payload.status === "skipped") {
      migrated.push({ id: row.id, status: "skipped", reason: payload.reason });
      continue;
    }

    const objectPath = `${folder}/${objectFolder}/${payload.fileName}`;
    await uploadBuffer(payload.buffer, objectPath, payload.contentType);
    const publicUrl = publicStorageUrl(objectPath);
    await execute(`UPDATE ${tableName} SET image = ?, updated_at = datetime('now') WHERE id = ?`, [publicUrl, row.id]);
    migrated.push({ id: row.id, title: row[labelColumn], status: "uploaded", publicUrl });
    console.log(`Uploaded ${tableName.slice(0, -1)} image: ${row[labelColumn] || row.id}`);
  }

  return migrated;
}

await ensureBucket();

const products = await migrateTable({ tableName: "products", objectFolder: "products", labelColumn: "name" });
const blogs = await migrateTable({ tableName: "blogs", objectFolder: "blogs", labelColumn: "title" });

console.log(JSON.stringify({ products, blogs }, null, 2));
