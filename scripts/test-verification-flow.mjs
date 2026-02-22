import dotenv from "dotenv";

dotenv.config();

const baseUrl = String(process.env.TEST_BASE_URL || "http://localhost:4000").trim();
const email = `qa-${Date.now()}@example.com`;
const password = "Password123!";

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
  const registerResult = await post("/api/auth/register", {
    firstName: "QA",
    lastName: "User",
    email,
    password,
    phone: "",
    address: "",
    city: ""
  });

  const resendResult = await post("/api/auth/resend-verification", { email });

  console.log(
    JSON.stringify(
      {
        email,
        register: registerResult,
        resend: resendResult
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
