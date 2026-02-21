import nodemailer from "nodemailer";

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

function parseBoolean(value, fallback = false) {
  const normalized = stripWrappingQuotes(value).toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
}

const SMTP_HOST = stripWrappingQuotes(process.env.SMTP_HOST || "");
const SMTP_PORT = Number(stripWrappingQuotes(process.env.SMTP_PORT || "587")) || 587;
const SMTP_USER = stripWrappingQuotes(process.env.SMTP_USER || "");
const SMTP_PASS = stripWrappingQuotes(process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "");
const SMTP_SECURE = parseBoolean(process.env.SMTP_SECURE, SMTP_PORT === 465);
const SMTP_REQUIRE_TLS = parseBoolean(process.env.SMTP_REQUIRE_TLS, false);
const SMTP_IGNORE_TLS = parseBoolean(process.env.SMTP_IGNORE_TLS, false);
const SMTP_TLS_REJECT_UNAUTHORIZED = parseBoolean(
  process.env.SMTP_TLS_REJECT_UNAUTHORIZED,
  true
);
const MAIL_FROM = stripWrappingQuotes(
  process.env.MAIL_FROM ||
    (SMTP_USER ? `IfeShadesnMore <${SMTP_USER}>` : "no-reply@ife-shadesnmore.local")
);

let transporter = null;

function getMailerConfigurationError() {
  if (!SMTP_HOST) {
    return "SMTP_HOST is not configured.";
  }

  if (SMTP_USER && !SMTP_PASS) {
    return "SMTP_USER is set but SMTP_PASS is missing.";
  }

  if (!SMTP_USER && SMTP_PASS) {
    return "SMTP_PASS is set but SMTP_USER is missing.";
  }

  return "";
}

export function isMailerConfigured() {
  return !getMailerConfigurationError();
}

function getTransporter() {
  if (!isMailerConfigured()) return null;
  if (transporter) return transporter;

  const transportOptions = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    requireTLS: SMTP_REQUIRE_TLS,
    ignoreTLS: SMTP_IGNORE_TLS,
    tls: {
      rejectUnauthorized: SMTP_TLS_REJECT_UNAUTHORIZED
    },
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000
  };

  if (SMTP_USER && SMTP_PASS) {
    transportOptions.auth = {
      user: SMTP_USER,
      pass: SMTP_PASS
    };
  }

  transporter = nodemailer.createTransport(transportOptions);

  return transporter;
}

export async function sendEmailVerification({ toEmail, fullName, verificationUrl }) {
  const transport = getTransporter();
  const greetingName = String(fullName || "").trim() || "there";

  const subject = "Verify your IfeShadesnMore account";
  const text = [
    `Hi ${greetingName},`,
    "",
    "Please verify your email to activate your account:",
    verificationUrl,
    "",
    "This link expires in 24 hours.",
    "",
    "If you did not create this account, you can ignore this email."
  ].join("\n");

  const html = `
    <p>Hi ${greetingName},</p>
    <p>Please verify your email to activate your account:</p>
    <p><a href="${verificationUrl}">Verify Email</a></p>
    <p>This link expires in 24 hours.</p>
    <p>If you did not create this account, you can ignore this email.</p>
  `;

  if (!transport) {
    const configError = getMailerConfigurationError();
    // eslint-disable-next-line no-console
    console.log(
      "[email-verification] Mailer not configured.",
      configError || "",
      "Verification URL:",
      verificationUrl
    );
    return { delivered: false };
  }

  await transport.sendMail({
    from: MAIL_FROM,
    to: toEmail,
    subject,
    text,
    html
  });

  return { delivered: true };
}
