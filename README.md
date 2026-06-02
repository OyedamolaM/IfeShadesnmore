 #  Ife_ShadesnMore

TanStack Start + Vite storefront with:
- Admin dashboard (`/admin`)
- Customer auth/profile/orders (`/account`)
- Paystack checkout + webhook verification
- Email verification for customer signup
- SSR product/legal pages with rich SEO, `robots.txt`, and `sitemap.xml`
- Cloudinary signed admin uploads for product and hero images
- Multi-collection products (one product can belong to multiple audiences)
- Dual DB support:
  - SQLite for local development
  - Postgres (`DATABASE_URL`) for production (Render/Vercel friendly)

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
   - Brevo (`MAIL_PROVIDER=brevo`)
4. For admin order-alert emails on every paid order, set:
   - `ORDER_ALERT_EMAIL` (single email or comma-separated list)
   - If empty, it falls back to `ADMIN_EMAIL`
4. If frontend and backend are deployed on different Render services/domains,
   set `VITE_API_BASE_URL` on the frontend service to your backend URL
   (for example `https://ife-shadesnmore.onrender.com`).
5. Google Analytics 4:
   - Set `VITE_GA_MEASUREMENT_ID` (example: `G-T3SYCHH988`)
   - Redeploy so Vite can bake it into the frontend build.
6. Cloudinary uploads:
   - Set `CLOUDINARY_URL` (`cloudinary://API_KEY:API_SECRET@CLOUD_NAME`)
   - Optional: set `CLOUDINARY_FOLDER` (defaults to `ife-shadesnmore`)

## 2) Run Locally

```bash
npm install
npm run dev
```

- App + API: `http://localhost:3000`

Local DB defaults to `server/data/ife-store.db` unless `DATABASE_URL` is set.

## 3) Admin Access

- Visit `http://localhost:5173/admin/login`
- Login with `ADMIN_EMAIL` and `ADMIN_PASSWORD`
- In Products tab:
  - Select multiple audience sections for one product
- In Settings tab:
  - Edit hero benefit bullets
  - Edit "Why Choose Us" bullets

## 4) Production Deployment

Set `DATABASE_URL` to a Postgres database in production. Vercel and other serverless
hosts do not provide a persistent writable filesystem, so SQLite can only be used as
a temporary fallback there and should not store real orders, products, or accounts.

### Render Deployment (Free Tier)

The included `render.yaml` is configured for free tier without a disk.

Required env vars in Render:
- `DATABASE_URL` (Neon/Postgres)
- `FRONTEND_URL` and `SITE_URL` (your Render app URL)
- `VITE_SITE_URL` (same public app URL, used for browser SEO fallbacks)
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `PAYSTACK_SECRET_KEY`
- `CLOUDINARY_URL` (for admin image uploads)
- Mail provider vars if you want real email delivery
- `ORDER_ALERT_EMAIL` (optional, defaults to `ADMIN_EMAIL`)

### Keep Free Render Service Warm (Optional)

This repo includes `.github/workflows/keep-render-awake.yml` which pings:

- `https://ife-shadesnmore.onrender.com/api/health`

every 5 minutes.  
If your domain/URL changes, update that URL in the workflow file.

## Order Notification Emails

When an order is marked as `paid` (via Paystack webhook or verify endpoint), the server sends
an email notification with customer details, delivery address, and items to:
- `ORDER_ALERT_EMAIL` (if set)
- otherwise `ADMIN_EMAIL`

Customer confirmation:
- By default, a confirmation/receipt email is also sent to the customer email on that order.
- Control with `CUSTOMER_ORDER_EMAIL_ENABLED=true|false`.
- Sender defaults to `MAIL_FROM`, or use `ORDER_MAIL_FROM` for a dedicated order sender.

## Account Welcome Emails

After a customer verifies their signup email, the server sends a separate account welcome email.
Control with `ACCOUNT_WELCOME_EMAIL_ENABLED=true|false`.
Sender defaults to `MAIL_FROM`, or use `WELCOME_MAIL_FROM` for account/newsletter emails.

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

## Brevo Checklist (No Custom Domain Needed)

If you do not have a domain yet, use Brevo API over HTTPS:

1. Create a Brevo API key with transactional email access.
2. Verify a sender in Brevo (an email you control).
3. Set:
   - `MAIL_PROVIDER=brevo`
   - `BREVO_API_KEY`
   - `BREVO_API_BASE_URL=https://api.brevo.com`
   - `MAIL_FROM=IfeShadesnMore <your-verified-sender-email>`
   - Optional: `WELCOME_MAIL_FROM=IfeShadesnMore <ife@ifeshades.com.ng>`
   - Optional: `ORDER_MAIL_FROM=IfeShadesnMore Orders <orders@ifeshades.com.ng>`
4. Redeploy and test signup/resend verification.

### Render SMTP Timeout Note
If logs show SMTP `ETIMEDOUT`/`ENETUNREACH` to `smtp.gmail.com`, use Resend API fallback on HTTPS:
- `MAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `RESEND_API_BASE_URL=https://api.resend.com`

If `MAIL_PROVIDER` is not set, provider priority is:
1. Brevo (`BREVO_API_KEY`)
2. Resend (`RESEND_API_KEY`)
3. SMTP
