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

function getSendGridConfig() {
  return {
    apiKey: stripWrappingQuotes(process.env.SENDGRID_API_KEY || ""),
    apiBaseUrl: stripWrappingQuotes(process.env.SENDGRID_API_BASE_URL || "https://api.sendgrid.com").replace(
      /\/+$/,
      ""
    )
  };
}

function resolveMailProvider({ resend, sendgrid }) {
  const preferred = stripWrappingQuotes(process.env.MAIL_PROVIDER || "").toLowerCase();
  if (preferred === "smtp" || preferred === "resend" || preferred === "sendgrid") {
    return preferred;
  }
  if (sendgrid.apiKey) return "sendgrid";
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

function getSendGridConfigurationError(sendgrid, config) {
  if (!sendgrid.apiKey) {
    return "SENDGRID_API_KEY is not configured.";
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
  const sendgrid = getSendGridConfig();
  const provider = resolveMailProvider({ resend, sendgrid });
  if (provider === "resend") {
    return !getResendConfigurationError(resend, config);
  }
  if (provider === "sendgrid") {
    return !getSendGridConfigurationError(sendgrid, config);
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
  const sendgrid = getSendGridConfig();
  const provider = resolveMailProvider({ resend, sendgrid });
  const configError =
    provider === "resend"
      ? getResendConfigurationError(resend, config)
      : provider === "sendgrid"
        ? getSendGridConfigurationError(sendgrid, config)
        : getMailerConfigurationError(config);
  return {
    provider,
    resendConfigured: Boolean(resend.apiKey),
    sendgridConfigured: Boolean(sendgrid.apiKey),
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

async function sendWithSendGrid({ config, toEmail, subject, text, html }) {
  const sendgrid = getSendGridConfig();
  if (!sendgrid.apiKey) {
    throw Object.assign(new Error("SENDGRID_API_KEY is missing."), {
      code: "SENDGRID_MISSING_KEY"
    });
  }

  const from = parseFromAddress(config.from);
  if (!from.email) {
    throw Object.assign(new Error("MAIL_FROM is missing or invalid for SendGrid."), {
      code: "SENDGRID_INVALID_FROM"
    });
  }

  const body = {
    personalizations: [
      {
        to: [{ email: toEmail }]
      }
    ],
    from: {
      email: from.email,
      ...(from.name ? { name: from.name } : {})
    },
    subject,
    content: [
      { type: "text/plain", value: text },
      { type: "text/html", value: html }
    ]
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${sendgrid.apiBaseUrl}/v3/mail/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgrid.apiKey}`,
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
      throw Object.assign(new Error(`SendGrid request failed (${response.status})`), {
        code: `SENDGRID_HTTP_${response.status}`,
        responseCode: response.status,
        response: details || ""
      });
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      throw Object.assign(new Error("SendGrid request timed out."), {
        code: "SENDGRID_TIMEOUT"
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

async function sendVerificationMessageWithRetry({ config, toEmail, subject, text, html }) {
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

export async function sendEmailVerification({ toEmail, fullName, verificationUrl }) {
  const config = getMailerConfig();
  const resend = getResendConfig();
  const sendgrid = getSendGridConfig();
  const provider = resolveMailProvider({ resend, sendgrid });
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

  if (provider === "resend") {
    const configError = getResendConfigurationError(resend, config);
    if (configError) {
      // eslint-disable-next-line no-console
      console.log("[email-verification] Mailer not configured.", configError);
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

  if (provider === "sendgrid") {
    const configError = getSendGridConfigurationError(sendgrid, config);
    if (configError) {
      // eslint-disable-next-line no-console
      console.log("[email-verification] Mailer not configured.", configError);
      return { delivered: false };
    }
    await sendWithSendGrid({
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
    console.log("[email-verification] Mailer not configured.", configError || "");
    return { delivered: false };
  }

  await sendVerificationMessageWithRetry({
    config,
    toEmail,
    subject,
    text,
    html
  });

  return { delivered: true };
}
