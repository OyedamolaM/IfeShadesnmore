import dotenv from "dotenv";

dotenv.config();

const email = String(process.argv[2] || "").trim().toLowerCase();
const baseUrl = String(process.argv[3] || process.env.TEST_BASE_URL || "http://localhost:4000")
  .trim()
  .replace(/\/+$/, "");
const password = String(process.argv[4] || "Password123!").trim();

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/test-live-email-flow.mjs <email> [baseUrl] [password]");
  process.exit(1);
}

async function post(path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function main() {
  const registerPayload = {
    firstName: "Live",
    lastName: "Test",
    email,
    password,
    phone: "",
    address: "",
    city: ""
  };

  const register = await post("/api/auth/register", registerPayload);
  const resend = await post("/api/auth/resend-verification", { email });

  console.log(
    JSON.stringify(
      {
        baseUrl,
        email,
        register,
        resend
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
