import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

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
const to = stripWrappingQuotes(process.env.SMTP_TEST_TO || user);

if (!host) {
  console.error("SMTP_HOST is missing.");
  process.exit(1);
}

if ((user && !pass) || (!user && pass)) {
  console.error("SMTP_USER/SMTP_PASS mismatch. Provide both or neither.");
  process.exit(1);
}

const transport = nodemailer.createTransport({
  host,
  port,
  secure,
  requireTLS,
  ignoreTLS,
  tls: {
    rejectUnauthorized
  },
  ...(user && pass ? { auth: { user, pass } } : {}),
  connectionTimeout: 20_000,
  greetingTimeout: 15_000,
  socketTimeout: 30_000
});

async function main() {
  console.log("Testing SMTP settings...");
  console.log(
    JSON.stringify(
      {
        host,
        port,
        secure,
        requireTLS,
        ignoreTLS,
        rejectUnauthorized,
        user: user ? `${user.slice(0, 2)}***` : "",
        from,
        to
      },
      null,
      2
    )
  );

  await transport.verify();
  console.log("SMTP verify passed.");

  const info = await transport.sendMail({
    from,
    to,
    subject: "IfeShadesnMore SMTP Test",
    text: "SMTP test successful.",
    html: "<p>SMTP test successful.</p>"
  });

  console.log("Mail sent.");
  console.log(
    JSON.stringify(
      {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("SMTP test failed.");
  console.error(
    JSON.stringify(
      {
        name: error?.name || "",
        code: error?.code || "",
        command: error?.command || "",
        responseCode: error?.responseCode || "",
        response: error?.response || "",
        message: error?.message || ""
      },
      null,
      2
    )
  );
  process.exit(1);
});
