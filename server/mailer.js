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

function getMailerConfig() {
  const host = stripWrappingQuotes(process.env.SMTP_HOST || "");
  const port = Number(stripWrappingQuotes(process.env.SMTP_PORT || "587")) || 587;
  const user = stripWrappingQuotes(process.env.SMTP_USER || "");
  const pass = stripWrappingQuotes(process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "");
  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465);
  const requireTLS = parseBoolean(process.env.SMTP_REQUIRE_TLS, false);
  const ignoreTLS = parseBoolean(process.env.SMTP_IGNORE_TLS, false);
  const rejectUnauthorized = parseBoolean(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true);
  const from = stripWrappingQuotes(
    process.env.MAIL_FROM || (user ? `IfeShadesnMore <${user}>` : "no-reply@ife-shadesnmore.local")
  );

  return {
    host,
    port,
    user,
    pass,
    secure,
    requireTLS,
    ignoreTLS,
    rejectUnauthorized,
    from
  };
}

function getMailerConfigKey(config) {
  return JSON.stringify([
    config.host,
    config.port,
    config.user,
    config.pass,
    config.secure,
    config.requireTLS,
    config.ignoreTLS,
    config.rejectUnauthorized
  ]);
}

let transporter = null;
let transporterConfigKey = "";

function getMailerConfigurationError(config) {
  if (!config.host) {
    return "SMTP_HOST is not configured.";
  }

  if (config.user && !config.pass) {
    return "SMTP_USER is set but SMTP_PASS is missing.";
  }

  if (!config.user && config.pass) {
    return "SMTP_PASS is set but SMTP_USER is missing.";
  }

  return "";
}

export function isMailerConfigured() {
  const config = getMailerConfig();
  return !getMailerConfigurationError(config);
}

function getTransporter() {
  const config = getMailerConfig();
  const configError = getMailerConfigurationError(config);
  if (configError) return { transport: null, config, configError };

  const configKey = getMailerConfigKey(config);
  if (transporter && transporterConfigKey === configKey) {
    return { transport: transporter, config, configError: "" };
  }

  const transportOptions = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    ignoreTLS: config.ignoreTLS,
    tls: {
      rejectUnauthorized: config.rejectUnauthorized
    },
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000
  };

  if (config.user && config.pass) {
    transportOptions.auth = {
      user: config.user,
      pass: config.pass
    };
  }

  transporter = nodemailer.createTransport(transportOptions);
  transporterConfigKey = configKey;
  return { transport: transporter, config, configError: "" };
}

export async function sendEmailVerification({ toEmail, fullName, verificationUrl }) {
  const { transport, config, configError } = getTransporter();
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
    // eslint-disable-next-line no-console
    console.log("[email-verification] Mailer not configured.", configError || "");
    return { delivered: false };
  }

  await transport.sendMail({
    from: config.from,
    to: toEmail,
    subject,
    text,
    html
  });

  return { delivered: true };
}
