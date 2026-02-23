 #  Ife_ShadesnMore

React + Express storefront with:
- Admin dashboard (`/admin`)
- Customer auth/profile/orders (`/account`)
- Paystack checkout + webhook verification
- Email verification for customer signup
- Multi-collection products (one product can belong to multiple audiences)
- Dual DB support:
  - SQLite for local development
  - Postgres (`DATABASE_URL`) for production (Render free tier friendly)

## 1) Setup

1. Copy `.env.example` to `.env`
2. Fill at least:
   - `JWT_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `PAYSTACK_SECRET_KEY`
3. For real verification emails, configure one provider:
   - SMTP (`MAIL_PROVIDER=smtp`) or
   - Resend (`MAIL_PROVIDER=resend`) or
   - SendGrid (`MAIL_PROVIDER=sendgrid`)
4. For admin order-alert emails on every paid order, set:
   - `ORDER_ALERT_EMAIL` (single email or comma-separated list)
   - If empty, it falls back to `ADMIN_EMAIL`
4. If frontend and backend are deployed on different Render services/domains,
   set `VITE_API_BASE_URL` on the frontend service to your backend URL
   (for example `https://ife-shadesnmore.onrender.com`).

## 2) Run Locally

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

Local DB defaults to `server/data/ife-store.db` unless `DATABASE_URL` is set.

## 3) Admin Access

- Visit `http://localhost:5173/admin/login`
- Login with `ADMIN_EMAIL` and `ADMIN_PASSWORD`
- In Products tab:
  - Select multiple audience sections for one product
- In Settings tab:
  - Edit hero benefit bullets
  - Edit "Why Choose Us" bullets

## 4) Render Deployment (Free Tier)

The included `render.yaml` is now configured for free tier without a disk.

Required env vars in Render:
- `DATABASE_URL` (Neon/Postgres)
- `FRONTEND_URL` (your Render app URL)
- `CORS_ORIGIN` (same as frontend URL)
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `PAYSTACK_SECRET_KEY`
- Mail provider vars if you want real email delivery
- `ORDER_ALERT_EMAIL` (optional, defaults to `ADMIN_EMAIL`)

## Order Notification Emails

When an order is marked as `paid` (via Paystack webhook or verify endpoint), the server sends
an email notification with customer details, delivery address, and items to:
- `ORDER_ALERT_EMAIL` (if set)
- otherwise `ADMIN_EMAIL`

Customer confirmation:
- By default, a confirmation/receipt email is also sent to the customer email on that order.
- Control with `CUSTOMER_ORDER_EMAIL_ENABLED=true|false`.

## 5) Migrate Existing SQLite Data to Postgres

After setting `DATABASE_URL`:

```bash
npm run migrate:sqlite-to-postgres
```

Optional source override:

```bash
SQLITE_MIGRATION_SOURCE=server/data/ife-store.db npm run migrate:sqlite-to-postgres
```

Windows CMD:

```bash
set SQLITE_MIGRATION_SOURCE=server/data/ife-store.db&& npm run migrate:sqlite-to-postgres
```

## Paystack Checklist

1. Use `PAYSTACK_SECRET_KEY` (`sk_test_...` or `sk_live_...`), never `pk_...`.
2. Set Paystack webhook URL to:
   - `https://<your-domain>/api/paystack/webhook`
3. Ensure `charge.success` webhook event is enabled.

## SMTP Checklist

Set:
- `MAIL_PROVIDER=smtp`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`

For Gmail app-password SMTP, use:
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`

Optional TLS flags:
- `SMTP_SECURE`
- `SMTP_REQUIRE_TLS`
- `SMTP_IGNORE_TLS`
- `SMTP_TLS_REJECT_UNAUTHORIZED`

## SendGrid Checklist (No Custom Domain Needed)

If you do not have a domain yet, use SendGrid API over HTTPS:

1. Create a SendGrid API key with Mail Send permission.
2. Verify a Single Sender Identity in SendGrid (an email you control).
3. Set:
   - `MAIL_PROVIDER=sendgrid`
   - `SENDGRID_API_KEY`
   - `SENDGRID_API_BASE_URL=https://api.sendgrid.com`
   - `MAIL_FROM=IfeShadesnMore <your-verified-sender-email>`
4. Redeploy and test signup/resend verification.

### Render SMTP Timeout Note
If logs show SMTP `ETIMEDOUT`/`ENETUNREACH` to `smtp.gmail.com`, use Resend API fallback on HTTPS:
- `MAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `RESEND_API_BASE_URL=https://api.resend.com`

If `MAIL_PROVIDER` is not set, provider priority is:
1. SendGrid (`SENDGRID_API_KEY`)
2. Resend (`RESEND_API_KEY`)
3. SMTP
