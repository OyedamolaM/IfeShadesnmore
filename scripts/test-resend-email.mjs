import dotenv from "dotenv";

dotenv.config();

const baseUrlArg = String(process.argv[3] || "").trim();
const baseUrl = String(baseUrlArg || process.env.TEST_BASE_URL || "http://localhost:4000")
  .trim()
  .replace(/\/+$/, "");
const email = String(process.argv[2] || "").trim().toLowerCase();

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/test-resend-email.mjs <email> [baseUrl]");
  process.exit(1);
}

async function main() {
  const response = await fetch(`${baseUrl}/api/auth/resend-verification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email })
  });

  const data = await response.json().catch(() => ({}));
  console.log(
    JSON.stringify(
      {
        baseUrl,
        email,
        status: response.status,
        data
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
