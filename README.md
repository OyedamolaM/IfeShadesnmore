# Ife_ShadesnMore

Secure React + Express storefront with:
- Admin login route (`/admin/login`) and protected admin manager (`/admin`)
- Customer auth (`/account/login`) and order history (`/account`)
- Server-side product/settings storage (SQLite backend)
- Server-side Paystack initialize + verify flow (no payment secrets in frontend)
- Email verification flow for customer signup

## 1) Setup

1. Copy `.env.example` to `.env`
2. Fill:
   - `JWT_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `PAYSTACK_SECRET_KEY`
   - SMTP vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM`) if you want real verification emails

## 2) Run

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

## 3) Admin Access

- Open `http://localhost:5173/admin/login`
- Login with `ADMIN_EMAIL` + `ADMIN_PASSWORD`
- Manage brand settings and products from `/admin`

## 4) Customer Flow

- Register/Login at `/account/login`
- Add products to cart and checkout
- Payment redirects to Paystack hosted checkout
- On return, payment is verified server-side and order appears in `/account`
- New customer logins require email verification first

## Security Notes

- Auth uses hashed passwords (`bcrypt`) and HTTP-only session cookie
- Role-protected endpoints for admin operations
- Payment verification is done in backend with Paystack secret key
- Storefront data is server-backed; sensitive flows are not stored in browser localStorage

## Paystack Checklist

Use this exact setup for reliable checkout and webhook processing:

1. Set `PAYSTACK_SECRET_KEY` to a **secret** key (`sk_test_...` or `sk_live_...`), not a public `pk_...` key.
2. Set `FRONTEND_URL` to your deployed frontend URL (used for Paystack callback URL).
3. In Paystack dashboard, set webhook URL to:
   - `https://<your-domain>/api/paystack/webhook`
4. Confirm the webhook event `charge.success` is enabled.

If checkout initialization fails with key errors, double-check:
- No `Bearer ` prefix in env value
- No accidental copy of public key (`pk_...`)
- No stale secret key from a different Paystack environment (test vs live)

## SMTP Checklist

Minimum required vars:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER` + `SMTP_PASS` (or neither, for open relay setups)
- `MAIL_FROM`

Optional TLS controls:
- `SMTP_SECURE` (typically `true` on 465, `false` on 587)
- `SMTP_REQUIRE_TLS`
- `SMTP_IGNORE_TLS`
- `SMTP_TLS_REJECT_UNAUTHORIZED`

## Hosting (Render)

This repo includes `render.yaml` for one-service hosting (API + frontend on the same domain).

### Steps

1. Push this project to GitHub/GitLab/Bitbucket.
2. In Render, create a new Blueprint and select your repo.
3. Set required environment variables in Render:
   - `FRONTEND_URL` = your Render app URL (for example `https://ife-shadesnmore.onrender.com`)
   - `CORS_ORIGIN` = same URL as above
   - `JWT_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `PAYSTACK_SECRET_KEY`
   - SMTP vars (for real email delivery)
4. Keep `DB_PATH=/var/data/ife-store.db` and attach disk `ife-store-data`.
5. Deploy.

### Important

- If SMTP is not configured, email verification still works for local testing through fallback verification links, but no real emails are sent.
- For production checkout, use Paystack live key (`sk_live...`) and webhook URL:
  - `https://<your-render-domain>/api/paystack/webhook`
