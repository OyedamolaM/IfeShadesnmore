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
  const debug = parseBoolean(process.env.SMTP_DEBUG, false);
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
    debug,
    secure,
    requireTLS,
    ignoreTLS,
    rejectUnauthorized,
    from
  };
}

function getResendConfig() {
  return {
    apiKey: stripWrappingQuotes(process.env.RESEND_API_KEY || ""),
    apiBaseUrl: stripWrappingQuotes(process.env.RESEND_API_BASE_URL || "https://api.resend.com").replace(
      /\/+$/,
      ""
    )
  };
}

function getBrevoConfig() {
  return {
    apiKey: stripWrappingQuotes(process.env.BREVO_API_KEY || ""),
    apiBaseUrl: stripWrappingQuotes(process.env.BREVO_API_BASE_URL || "https://api.brevo.com").replace(
      /\/+$/,
      ""
    )
  };
}

function getSenderFromEnv(envName) {
  return stripWrappingQuotes(process.env[envName] || process.env.MAIL_FROM || "");
}

function resolveMailProvider({ resend, brevo }) {
  const preferred = stripWrappingQuotes(process.env.MAIL_PROVIDER || "").toLowerCase();
  if (preferred === "smtp" || preferred === "resend" || preferred === "brevo") {
    return preferred;
  }
  if (brevo.apiKey) return "brevo";
  if (resend.apiKey) return "resend";
  return "smtp";
}

function parseFromAddress(from) {
  const text = String(from || "").trim();
  if (!text) {
    return { name: "", email: "" };
  }
  const match = text.match(/^(.*)<([^<>]+)>$/);
  if (!match) {
    return { name: "", email: text };
  }
  const rawName = match[1].trim().replace(/^["']|["']$/g, "");
  const email = match[2].trim();
  return { name: rawName, email };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(amount, currency = "NGN") {
  const safeAmount = Number(amount) || 0;
  const safeCurrency = String(currency || "NGN").trim().toUpperCase() || "NGN";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 0
    }).format(safeAmount);
  } catch {
    return `${safeCurrency} ${safeAmount.toLocaleString("en-NG")}`;
  }
}

function getMailerConfigKey(config) {
  return JSON.stringify([
    config.host,
    config.port,
    config.user,
    config.pass,
    config.debug,
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

function getResendConfigurationError(resend, config) {
  if (!resend.apiKey) {
    return "RESEND_API_KEY is not configured.";
  }
  const from = parseFromAddress(config.from);
  if (!from.email) {
    return "MAIL_FROM is not configured.";
  }
  return "";
}

function getBrevoConfigurationError(brevo, config) {
  if (!brevo.apiKey) {
    return "BREVO_API_KEY is not configured.";
  }
  const from = parseFromAddress(config.from);
  if (!from.email) {
    return "MAIL_FROM is not configured.";
  }
  return "";
}

export function isMailerConfigured() {
  const config = getMailerConfig();
  const resend = getResendConfig();
  const brevo = getBrevoConfig();
  const provider = resolveMailProvider({ resend, brevo });
  if (provider === "resend") {
    return !getResendConfigurationError(resend, config);
  }
  if (provider === "brevo") {
    return !getBrevoConfigurationError(brevo, config);
  }
  return !getMailerConfigurationError(config);
}

function maskEmail(value) {
  const text = String(value || "").trim();
  if (!text.includes("@")) return "";
  const [name, domain] = text.split("@");
  if (!name || !domain) return "";
  const safeName = name.length <= 2 ? `${name[0] || "*"}*` : `${name.slice(0, 2)}***`;
  return `${safeName}@${domain}`;
}

export function getMailerRuntimeInfo() {
  const config = getMailerConfig();
  const resend = getResendConfig();
  const brevo = getBrevoConfig();
  const provider = resolveMailProvider({ resend, brevo });
  const configError =
    provider === "resend"
      ? getResendConfigurationError(resend, config)
      : provider === "brevo"
        ? getBrevoConfigurationError(brevo, config)
        : getMailerConfigurationError(config);
  return {
    provider,
    resendConfigured: Boolean(resend.apiKey),
    brevoConfigured: Boolean(brevo.apiKey),
    configured: !configError,
    configError: configError || "",
    host: config.host,
    port: config.port,
    secure: config.secure,
    debugEnabled: config.debug,
    requireTLS: config.requireTLS,
    ignoreTLS: config.ignoreTLS,
    rejectUnauthorized: config.rejectUnauthorized,
    hasUser: Boolean(config.user),
    hasPass: Boolean(config.pass),
    userPreview: maskEmail(config.user),
    from: config.from
  };
}

async function sendWithResend({ config, toEmail, subject, text, html }) {
  const resend = getResendConfig();
  if (!resend.apiKey) {
    throw Object.assign(new Error("RESEND_API_KEY is missing."), {
      code: "RESEND_MISSING_KEY"
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${resend.apiBaseUrl}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: config.from,
        to: [toEmail],
        subject,
        text,
        html
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.message || `Resend request failed (${response.status})`;
      throw Object.assign(new Error(message), {
        code: `RESEND_HTTP_${response.status}`,
        responseCode: response.status,
        response: JSON.stringify(payload || {})
      });
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("Resend request timed out."), {
        code: "RESEND_TIMEOUT"
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendWithBrevo({ config, toEmail, subject, text, html }) {
  const brevo = getBrevoConfig();
  if (!brevo.apiKey) {
    throw Object.assign(new Error("BREVO_API_KEY is missing."), {
      code: "BREVO_MISSING_KEY"
    });
  }

  const from = parseFromAddress(config.from);
  if (!from.email) {
    throw Object.assign(new Error("MAIL_FROM is missing or invalid for Brevo."), {
      code: "BREVO_INVALID_FROM"
    });
  }

  const body = {
    sender: {
      ...(from.name ? { name: from.name } : {}),
      email: from.email
    },
    to: [
      {
        email: toEmail
      }
    ],
    subject,
    textContent: text,
    htmlContent: html
  };

  if (from.name) {
    body.replyTo = {
      email: from.email,
      name: from.name
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${brevo.apiBaseUrl}/v3/smtp/email`, {
      method: "POST",
      headers: {
        "api-key": brevo.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    let payload = "";
    try {
      payload = await response.text();
    } catch (error) {
      payload = "";
    }

    if (!response.ok) {
      let details = payload;
      if (payload) {
        try {
          details = JSON.stringify(JSON.parse(payload));
        } catch (error) {
          details = payload;
        }
      }
      throw Object.assign(new Error(`Brevo request failed (${response.status})`), {
        code: `BREVO_HTTP_${response.status}`,
        responseCode: response.status,
        response: details || ""
      });
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("Brevo request timed out."), {
        code: "BREVO_TIMEOUT"
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function createTransportFromConfig(config) {
  const transportOptions = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    logger: config.debug,
    debug: config.debug,
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

  return nodemailer.createTransport(transportOptions);
}

function getTransporter() {
  const config = getMailerConfig();
  const configError = getMailerConfigurationError(config);
  if (configError) return { transport: null, config, configError };

  const configKey = getMailerConfigKey(config);
  if (transporter && transporterConfigKey === configKey) {
    return { transport: transporter, config, configError: "" };
  }

  transporter = createTransportFromConfig(config);
  transporterConfigKey = configKey;
  return { transport: transporter, config, configError: "" };
}

function isRetryableSmtpError(error) {
  const code = String(error?.code || "").toUpperCase();
  const command = String(error?.command || "").toUpperCase();
  const responseCode = Number(error?.responseCode || 0);

  if (["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ECONNRESET", "EPIPE"].includes(code)) {
    return true;
  }

  if (responseCode >= 400 && responseCode < 500) {
    return true;
  }

  if (command === "CONN" || command === "STARTTLS") {
    return true;
  }

  return false;
}

function summarizeMailerTarget(config) {
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    ignoreTLS: config.ignoreTLS
  };
}

function getFallbackMailerConfig(config) {
  const host = String(config.host || "").trim().toLowerCase();
  if (host !== "smtp.gmail.com") return null;

  if (Number(config.port) === 465) {
    return {
      ...config,
      port: 587,
      secure: false,
      requireTLS: true
    };
  }

  if (Number(config.port) === 587) {
    return {
      ...config,
      port: 465,
      secure: true,
      requireTLS: false
    };
  }

  return null;
}

async function sendWithTransport(transport, config, { toEmail, subject, text, html }) {
  await transport.sendMail({
    from: config.from,
    to: toEmail,
    subject,
    text,
    html
  });
}

async function sendSmtpMessageWithRetry({ config, toEmail, subject, text, html }) {
  const first = getTransporter();
  if (!first.transport) {
    throw Object.assign(new Error("Mailer transport is unavailable."), { code: "MAILER_UNAVAILABLE" });
  }

  const attemptedTargets = [];

  try {
    attemptedTargets.push(summarizeMailerTarget(config));
    await sendWithTransport(first.transport, config, { toEmail, subject, text, html });
    return;
  } catch (error) {
    error.mailerTarget = summarizeMailerTarget(config);
    if (!isRetryableSmtpError(error)) {
      error.mailerAttempted = attemptedTargets;
      throw error;
    }
  }

  let lastError = null;

  // Retry once using a fresh transport with the same SMTP profile.
  transporter = null;
  transporterConfigKey = "";
  try {
    const retry = getTransporter();
    if (!retry.transport) {
      throw Object.assign(new Error("Mailer transport is unavailable on retry."), {
        code: "MAILER_UNAVAILABLE_RETRY"
      });
    }
    attemptedTargets.push(summarizeMailerTarget(config));
    await sendWithTransport(retry.transport, config, { toEmail, subject, text, html });
    return;
  } catch (error) {
    lastError = error;
    error.mailerTarget = summarizeMailerTarget(config);
    if (!isRetryableSmtpError(error)) {
      error.mailerAttempted = attemptedTargets;
      throw error;
    }
  }

  // Final attempt: switch Gmail between implicit TLS (465) and STARTTLS (587).
  const fallbackConfig = getFallbackMailerConfig(config);
  if (!fallbackConfig) {
    if (lastError) {
      lastError.mailerAttempted = attemptedTargets;
      throw lastError;
    }
    throw new Error("Mailer send failed.");
  }

  const fallbackTransport = createTransportFromConfig(fallbackConfig);
  try {
    attemptedTargets.push(summarizeMailerTarget(fallbackConfig));
    await sendWithTransport(fallbackTransport, fallbackConfig, { toEmail, subject, text, html });
    return;
  } catch (error) {
    error.mailerTarget = summarizeMailerTarget(fallbackConfig);
    error.mailerAttempted = attemptedTargets;
    throw error;
  } finally {
    if (typeof fallbackTransport.close === "function") {
      fallbackTransport.close();
    }
  }
}

async function sendTransactionalEmail({ toEmail, subject, text, html, logPrefix, from }) {
  const config = {
    ...getMailerConfig(),
    ...(from ? { from: stripWrappingQuotes(from) } : {})
  };
  const resend = getResendConfig();
  const brevo = getBrevoConfig();
  const provider = resolveMailProvider({ resend, brevo });

  if (provider === "resend") {
    const configError = getResendConfigurationError(resend, config);
    if (configError) {
      // eslint-disable-next-line no-console
      console.log(`${logPrefix} Mailer not configured.`, configError);
      return { delivered: false };
    }
    await sendWithResend({
      config,
      toEmail,
      subject,
      text,
      html
    });
    return { delivered: true };
  }

  if (provider === "brevo") {
    const configError = getBrevoConfigurationError(brevo, config);
    if (configError) {
      // eslint-disable-next-line no-console
      console.log(`${logPrefix} Mailer not configured.`, configError);
      return { delivered: false };
    }
    await sendWithBrevo({
      config,
      toEmail,
      subject,
      text,
      html
    });
    return { delivered: true };
  }

  const { transport, configError } = getTransporter();
  if (!transport) {
    // eslint-disable-next-line no-console
    console.log(`${logPrefix} Mailer not configured.`, configError || "");
    return { delivered: false };
  }

  await sendSmtpMessageWithRetry({
    config,
    toEmail,
    subject,
    text,
    html
  });

  return { delivered: true };
}

export async function sendEmailVerification({ toEmail, fullName, verificationUrl }) {
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

  return sendTransactionalEmail({
    toEmail,
    subject,
    text,
    html,
    logPrefix: "[email-verification]",
    from: getSenderFromEnv("WELCOME_MAIL_FROM")
  });
}

export async function sendNewsletterWelcome({ toEmail, source }) {
  const safeEmail = String(toEmail || "").trim();
  const safeSource = String(source || "newsletter").trim() || "newsletter";
  const subject = "You are on the IfeShadesnMore drop list";
  const text = [
    "Hi there,",
    "",
    "You are now on the IfeShadesnMore drop list.",
    "We will send you early access to new frame drops, restock notes, and member-only updates.",
    "",
    "Thanks for joining us.",
    "",
    `Subscribed email: ${safeEmail}`,
    `Source: ${safeSource}`
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1f1a17;background:#fdf8f3;padding:28px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #eadfd4;border-radius:18px;padding:28px;">
        <p style="margin:0 0 8px;color:#c96e4c;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">IfeShadesnMore</p>
        <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:32px;line-height:1.05;color:#2d1b11;">You are on the drop list.</h1>
        <p style="margin:0 0 14px;line-height:1.65;color:#5d514a;">We will send you early access to new frame drops, restock notes, and member-only updates.</p>
        <p style="margin:0;color:#7b6f68;font-size:13px;">Subscribed email: ${escapeHtml(safeEmail)}</p>
      </div>
    </div>
  `;

  return sendTransactionalEmail({
    toEmail,
    subject,
    text,
    html,
    logPrefix: "[newsletter-welcome]",
    from: getSenderFromEnv("WELCOME_MAIL_FROM")
  });
}

export async function sendNewsletterAdminNotification({ toEmail, subscriberEmail, source }) {
  const safeSubscriberEmail = String(subscriberEmail || "").trim();
  const safeSource = String(source || "newsletter").trim() || "newsletter";
  const subject = `New newsletter subscriber: ${safeSubscriberEmail || "IfeShadesnMore"}`;
  const text = [
    "A new email joined the newsletter list.",
    "",
    `Email: ${safeSubscriberEmail || "N/A"}`,
    `Source: ${safeSource}`
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <h2 style="margin:0 0 12px;">New newsletter subscriber</h2>
      <p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(safeSubscriberEmail || "N/A")}</p>
      <p style="margin:0;"><strong>Source:</strong> ${escapeHtml(safeSource)}</p>
    </div>
  `;

  return sendTransactionalEmail({
    toEmail,
    subject,
    text,
    html,
    logPrefix: "[newsletter-admin-notification]",
    from: getSenderFromEnv("WELCOME_MAIL_FROM")
  });
}

export async function sendAccountWelcome({ toEmail, fullName }) {
  const greetingName = String(fullName || "").trim() || "there";
  const subject = "Welcome to IfeShadesnMore";
  const text = [
    `Hi ${greetingName},`,
    "",
    "Welcome to IfeShadesnMore.",
    "Your account is now active, so you can save your details, checkout faster, and keep track of your orders.",
    "",
    "Thank you for joining us.",
    "",
    "IfeShadesnMore"
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1f1a17;background:#fdf8f3;padding:28px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #eadfd4;border-radius:18px;padding:28px;">
        <p style="margin:0 0 8px;color:#c96e4c;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">IfeShadesnMore</p>
        <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:32px;line-height:1.05;color:#2d1b11;">Welcome, ${escapeHtml(greetingName)}.</h1>
        <p style="margin:0 0 14px;line-height:1.65;color:#5d514a;">Your account is now active, so you can save your details, checkout faster, and keep track of your orders.</p>
        <p style="margin:0;color:#7b6f68;font-size:13px;">Thank you for joining us.</p>
      </div>
    </div>
  `;

  return sendTransactionalEmail({
    toEmail,
    subject,
    text,
    html,
    logPrefix: "[account-welcome]",
    from: getSenderFromEnv("WELCOME_MAIL_FROM")
  });
}

export async function sendOrderNotification({ toEmail, order, items }) {
  const safeOrder = {
    id: String(order?.id || "").trim(),
    fullName: String(order?.fullName || "").trim(),
    email: String(order?.email || "").trim(),
    phone: String(order?.phone || "").trim(),
    address: String(order?.address || "").trim(),
    city: String(order?.city || "").trim(),
    paymentMethod: String(order?.paymentMethod || "").trim(),
    paymentStatus: String(order?.paymentStatus || "").trim(),
    paymentChannel: String(order?.paymentChannel || "").trim(),
    orderStatus: String(order?.orderStatus || "").trim(),
    subtotal: Number(order?.subtotal) || 0,
    currency: String(order?.currency || "NGN").trim() || "NGN",
    createdAt: String(order?.createdAt || "").trim()
  };

  const orderTotal = formatCurrency(safeOrder.subtotal, safeOrder.currency);
  const itemList = Array.isArray(items) ? items : [];
  const textItems = itemList.length
    ? itemList
        .map(
          (item, index) =>
            `${index + 1}. ${String(item.name || "Product")} x${Number(item.quantity) || 0} - ${formatCurrency(
              Number(item.lineTotal) || 0,
              safeOrder.currency
            )}`
        )
        .join("\n")
    : "No item breakdown available.";

  const htmlRows = itemList.length
    ? itemList
        .map(
          (item) => `
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(item.name || "Product")}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${Number(item.quantity) || 0}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${escapeHtml(
                formatCurrency(Number(item.lineTotal) || 0, safeOrder.currency)
              )}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="3" style="padding:8px;border:1px solid #e5e7eb;">No item breakdown available.</td></tr>`;

  const subject = `New paid order: ${safeOrder.id || "IfeShadesnMore"}`;
  const text = [
    "A new paid order was received.",
    "",
    `Order ID: ${safeOrder.id || "N/A"}`,
    `Customer: ${safeOrder.fullName || "N/A"}`,
    `Email: ${safeOrder.email || "N/A"}`,
    `Phone: ${safeOrder.phone || "N/A"}`,
    `Address: ${safeOrder.address || "N/A"}`,
    `City: ${safeOrder.city || "N/A"}`,
    `Payment Method: ${safeOrder.paymentMethod || "N/A"}`,
    `Payment Status: ${safeOrder.paymentStatus || "N/A"}`,
    `Payment Channel: ${safeOrder.paymentChannel || "N/A"}`,
    `Order Status: ${safeOrder.orderStatus || "N/A"}`,
    `Order Total: ${orderTotal}`,
    safeOrder.createdAt ? `Created At: ${safeOrder.createdAt}` : "",
    "",
    "Items:",
    textItems
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <h2 style="margin:0 0 12px;">A new paid order was received</h2>
      <p style="margin:0 0 6px;"><strong>Order ID:</strong> ${escapeHtml(safeOrder.id || "N/A")}</p>
      <p style="margin:0 0 6px;"><strong>Customer:</strong> ${escapeHtml(safeOrder.fullName || "N/A")}</p>
      <p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(safeOrder.email || "N/A")}</p>
      <p style="margin:0 0 6px;"><strong>Phone:</strong> ${escapeHtml(safeOrder.phone || "N/A")}</p>
      <p style="margin:0 0 6px;"><strong>Address:</strong> ${escapeHtml(safeOrder.address || "N/A")}</p>
      <p style="margin:0 0 6px;"><strong>City:</strong> ${escapeHtml(safeOrder.city || "N/A")}</p>
      <p style="margin:0 0 6px;"><strong>Payment Method:</strong> ${escapeHtml(safeOrder.paymentMethod || "N/A")}</p>
      <p style="margin:0 0 6px;"><strong>Payment Status:</strong> ${escapeHtml(safeOrder.paymentStatus || "N/A")}</p>
      <p style="margin:0 0 6px;"><strong>Payment Channel:</strong> ${escapeHtml(safeOrder.paymentChannel || "N/A")}</p>
      <p style="margin:0 0 6px;"><strong>Order Status:</strong> ${escapeHtml(safeOrder.orderStatus || "N/A")}</p>
      <p style="margin:0 0 12px;"><strong>Order Total:</strong> ${escapeHtml(orderTotal)}</p>
      <table style="border-collapse:collapse;width:100%;margin-top:8px;">
        <thead>
          <tr>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Item</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:center;">Qty</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
    </div>
  `;

  return sendTransactionalEmail({
    toEmail,
    subject,
    text,
    html,
    logPrefix: "[order-notification]",
    from: getSenderFromEnv("ORDER_MAIL_FROM")
  });
}

export async function sendCustomerOrderConfirmation({ toEmail, order, items }) {
  const safeOrder = {
    id: String(order?.id || "").trim(),
    fullName: String(order?.fullName || "").trim(),
    email: String(order?.email || "").trim(),
    phone: String(order?.phone || "").trim(),
    address: String(order?.address || "").trim(),
    city: String(order?.city || "").trim(),
    paymentMethod: String(order?.paymentMethod || "").trim(),
    paymentStatus: String(order?.paymentStatus || "").trim(),
    paymentChannel: String(order?.paymentChannel || "").trim(),
    orderStatus: String(order?.orderStatus || "").trim(),
    subtotal: Number(order?.subtotal) || 0,
    currency: String(order?.currency || "NGN").trim() || "NGN",
    createdAt: String(order?.createdAt || "").trim()
  };

  const greetingName = safeOrder.fullName || "there";
  const orderTotal = formatCurrency(safeOrder.subtotal, safeOrder.currency);
  const itemList = Array.isArray(items) ? items : [];
  const textItems = itemList.length
    ? itemList
        .map(
          (item, index) =>
            `${index + 1}. ${String(item.name || "Product")} x${Number(item.quantity) || 0} - ${formatCurrency(
              Number(item.lineTotal) || 0,
              safeOrder.currency
            )}`
        )
        .join("\n")
    : "No item breakdown available.";

  const htmlRows = itemList.length
    ? itemList
        .map(
          (item) => `
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(item.name || "Product")}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${Number(item.quantity) || 0}</td>
              <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${escapeHtml(
                formatCurrency(Number(item.lineTotal) || 0, safeOrder.currency)
              )}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="3" style="padding:8px;border:1px solid #e5e7eb;">No item breakdown available.</td></tr>`;

  const subject = `Order Confirmation: ${safeOrder.id || "IfeShadesnMore"}`;
  const text = [
    `Hi ${greetingName},`,
    "",
    "Thank you for your order with IfeShadesnMore.",
    "Your payment was confirmed and your order is now being processed.",
    "",
    `Order ID: ${safeOrder.id || "N/A"}`,
    `Order Total: ${orderTotal}`,
    `Payment Method: ${safeOrder.paymentMethod || "N/A"}`,
    `Payment Channel: ${safeOrder.paymentChannel || "N/A"}`,
    `Delivery Address: ${safeOrder.address || "N/A"}, ${safeOrder.city || ""}`.trim(),
    safeOrder.createdAt ? `Order Date: ${safeOrder.createdAt}` : "",
    "",
    "Items:",
    textItems,
    "",
    "If you need support, reply to this email or contact us on WhatsApp."
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <h2 style="margin:0 0 12px;">Order Confirmation</h2>
      <p>Hi ${escapeHtml(greetingName)},</p>
      <p>Thank you for your order with IfeShadesnMore.</p>
      <p>Your payment was confirmed and your order is now being processed.</p>
      <p style="margin:0 0 6px;"><strong>Order ID:</strong> ${escapeHtml(safeOrder.id || "N/A")}</p>
      <p style="margin:0 0 6px;"><strong>Order Total:</strong> ${escapeHtml(orderTotal)}</p>
      <p style="margin:0 0 6px;"><strong>Payment Method:</strong> ${escapeHtml(safeOrder.paymentMethod || "N/A")}</p>
      <p style="margin:0 0 6px;"><strong>Payment Channel:</strong> ${escapeHtml(safeOrder.paymentChannel || "N/A")}</p>
      <p style="margin:0 0 6px;"><strong>Delivery Address:</strong> ${escapeHtml(
        `${safeOrder.address || "N/A"}${safeOrder.city ? `, ${safeOrder.city}` : ""}`
      )}</p>
      <table style="border-collapse:collapse;width:100%;margin-top:12px;">
        <thead>
          <tr>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Item</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:center;">Qty</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
      <p style="margin-top:12px;">If you need support, contact us on WhatsApp.</p>
    </div>
  `;

  return sendTransactionalEmail({
    toEmail,
    subject,
    text,
    html,
    logPrefix: "[customer-order-confirmation]",
    from: getSenderFromEnv("ORDER_MAIL_FROM")
  });
}
