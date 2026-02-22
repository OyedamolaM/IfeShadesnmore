 #  Ife_ShadesnMore

React + Express storefront with:
- Admin dashboard (`/admin`)
- Customer auth/profile/orders (`/account`)
- Paystack checkout + webhook verification
- Email verification for customer signup
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
3. For real verification emails, also fill SMTP values.

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
- SMTP vars if you want real email delivery

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
