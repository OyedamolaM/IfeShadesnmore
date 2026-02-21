import crypto from "node:crypto";

const PAYSTACK_BASE_URL = String(process.env.PAYSTACK_BASE_URL || "https://api.paystack.co")
  .trim()
  .replace(/\/+$/, "");

function stripWrappingQuotes(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function normalizeSecretKey(value) {
  let key = stripWrappingQuotes(value);
  if (key.toLowerCase().startsWith("bearer ")) {
    key = key.slice(7).trim();
  }
  return key;
}

function getSecretKey() {
  return normalizeSecretKey(
    process.env.PAYSTACK_SECRET_KEY ||
      process.env.PAYSTACK_SECRET ||
      process.env.PAYSTACK_SK ||
      ""
  );
}

function hasPaystackKey() {
  return Boolean(getSecretKey().trim());
}

function isValidSecretKeyFormat(value) {
  const key = String(value || "").trim();
  return key.startsWith("sk_test_") || key.startsWith("sk_live_");
}

function getPaystackConfigIssue() {
  const secretKey = getSecretKey();
  if (!secretKey) {
    return "PAYSTACK_SECRET_KEY is not configured.";
  }

  if (secretKey.startsWith("pk_test_") || secretKey.startsWith("pk_live_")) {
    return "A Paystack public key (pk_...) was provided. Use PAYSTACK_SECRET_KEY with sk_test_... or sk_live_....";
  }

  if (!isValidSecretKeyFormat(secretKey)) {
    return "PAYSTACK_SECRET_KEY must be a Paystack secret key (sk_test_... or sk_live_...).";
  }

  return "";
}

async function paystackRequest(path, init = {}) {
  const secretKey = getSecretKey().trim();
  const configIssue = getPaystackConfigIssue();
  if (configIssue) {
    throw new Error(configIssue);
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status === false) {
    const message = payload?.message || `Paystack request failed (${response.status})`;
    throw new Error(message);
  }
  return payload.data;
}

export async function initializeTransaction({
  email,
  amountInKobo,
  reference,
  callbackUrl,
  channels,
  metadata
}) {
  return paystackRequest("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email,
      amount: amountInKobo,
      reference,
      callback_url: callbackUrl,
      channels,
      metadata
    })
  });
}

export async function verifyTransaction(reference) {
  const encoded = encodeURIComponent(reference);
  return paystackRequest(`/transaction/verify/${encoded}`, { method: "GET" });
}

export function isPaystackConfigured() {
  return hasPaystackKey() && !getPaystackConfigIssue();
}

export function getPaystackConfigurationError() {
  return getPaystackConfigIssue();
}

export function verifyWebhookSignature(rawBody, signatureHeader) {
  const secretKey = getSecretKey();
  if (!secretKey) {
    return { ok: false, reason: "missing_secret" };
  }

  const signature = String(signatureHeader || "").trim();
  if (!signature) {
    return { ok: false, reason: "missing_signature" };
  }

  const bodyBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(String(rawBody || ""), "utf8");
  const expected = crypto.createHmac("sha512", secretKey).update(bodyBuffer).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return { ok: false, reason: "invalid_signature" };
  }

  const ok = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  return { ok, reason: ok ? "" : "invalid_signature" };
}
