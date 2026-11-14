# Lifetone

Sri Lanka travel marketplace: stays, drivers, transport companies, guides, room shares, and sports and business packages from licensed local providers.

The app is built as a **multi-brand (white-label) platform**. Lifetone is the first brand (lifetone.online). More brands can run on the same deployment, each on its own domain with its own name, colours, commission and data. The platform owner (DBS Group) takes a platform fee, set per brand (default 10% of brand revenue).

## What's in this version

**Guests**
- Search and filter listings by place and type
- Book with live pricing; pay by card, a deposit plus cash, or cash on the day (if the brand allows cash)
- No account needed: confirmation and updates by email, each with a link that signs them into the booking
- My bookings: sign in with a one-time email link, see bookings, request a date change, cancel (free up to 48 hours before), message the provider

**Providers**
- Apply to list a service (SLTDA licence or NTC route permit required); listings go live after approval

**Client portal** (`/portal`, brand admins)
- Overview with everything needing action: booking requests, date changes, new providers
- Bookings: search, filter, confirm, decline, complete, cancel and refund; message guests
- Listings: approve, reject, pause, change prices
- Payouts: split per booking, provider balances (cash bookings recovered from card payouts), settlement currency
- Guest emails log, customer updates, brand settings

**Platform console** (only at `platform.dbsgroup.io`, set by `PLATFORM_HOST`; never reachable on brand sites)
- All brands with booking value, brand revenue and platform fees earned
- Create brands (name, domains, booking prefix, platform fee, first admin)
- Per-brand theme: preset (Tropical, Luxury, Minimal), colours, fonts, logo, home page headline, intro and hero photo
- Switch a brand off; add brand admins
- Platform admins sign in only here; brand admins only on their brand's site

## Tech

- Next.js 14 (App Router, server actions), React 18, TypeScript
- PostgreSQL with Prisma 5
- Passwordless sign-in with one-time email links; signed session cookies
- Payments behind a `PaymentGateway` interface: `mock` for development, `dpayments` for production (`src/lib/payments/`)
- Email through Resend's API when configured; otherwise logged to the database and console
- Money stored as integers in LKR cents. Pricing and split logic in `src/lib/pricing.ts`, with tests

## Run locally

Needs Node 20+ and PostgreSQL.

```bash
cp .env.example .env          # then fill in DATABASE_URL and SESSION_SECRET
npm install
npm run db:push               # create tables
npm run db:seed               # Lifetone brand, admin accounts, example listings
npm run dev
```

Open http://localhost:3000. To sign in as the brand admin, go to `/signin` and enter `BRAND_ADMIN_EMAIL` from your `.env`. Without Resend set up, the sign-in link is printed in the terminal and listed under Client portal → Guest emails.

With `PAYMENT_GATEWAY=mock`, card payments open a test page where you choose success or failure.

Run the pricing tests with `npm test`.

## Deploy with Docker (current setup)

`docker-compose.yml` runs PostgreSQL and the app with no public ports. The VPS's existing Caddy proxy (InvoiceFlow project) forwards `lifetone.online` to the `lifetone-web` container over the shared `invoiceflow_default` network. Secrets (`DB_PASSWORD`, `SESSION_SECRET`, `ADMIN_LOGIN_TOKEN`, …) are set as the project's environment variables, never in the repo.

The proxy rule lives on the server in `/root/invoiceflow/deploy/sites/lifetone.caddy` (outside InvoiceFlow's code, so InvoiceFlow updates keep it):

```
lifetone.online, www.lifetone.online {
	encode gzip
	reverse_proxy lifetone-web:3000
}
```

After changing it, run `docker compose restart caddy` in `/root/invoiceflow`.

While `DEMO_MODE=true`, card payments are simulated and a banner says so. For real payments set `PAYMENT_GATEWAY=dpayments`, the DPayments keys and `DEMO_MODE=false`.

To redeploy after pushing to `main`, rebuild the project (Hostinger Docker Manager → lifetone → Update, or `docker compose up -d --build`).

## Deploy to the Hostinger VPS (manual alternative)

The app needs Node.js and PostgreSQL, so it runs on the VPS (Ubuntu) rather than shared hosting, which only offers MySQL.

1. **On the VPS:** install Node 20, PostgreSQL, and a process manager (`pm2`) and a reverse proxy (Nginx or Caddy).
2. **Database:** create a `lifetone` database and user; put the connection string in `DATABASE_URL`.
3. **App:** clone this repo, create `.env` (strong `SESSION_SECRET`, `APP_URL=https://lifetone.online`), then:
   ```bash
   npm ci && npm run build && npx prisma migrate deploy   # or db:push for the first release
   npm run db:seed
   pm2 start npm --name lifetone -- start
   ```
4. **Domain:** point `lifetone.online` and `www.lifetone.online` (A records) to the VPS IP, and proxy them to port 3000 with HTTPS (Caddy does certificates automatically).
5. **Payments:** set `PAYMENT_GATEWAY=dpayments` and the DPayments keys. Point the DPayments webhook to `https://lifetone.online/api/payments/webhook`.
6. **Email:** add `lifetone.online` as a sending domain in Resend, add its DNS records, set `RESEND_API_KEY`, and set the sender (e.g. `Lifetone Bookings <bookings@lifetone.online>`) in Client portal → Brand settings.

## Adding another brand

Insert a row in `Brand` with its `slug`, `name`, `domains`, `bookingPrefix`, `color` and `platformFeePct`, create a `BRAND_ADMIN` user for it, and point its domain at the same server. In development, `<slug>.localhost:3000` serves that brand.

## Before going live

- **DPayments adapter:** `src/lib/payments/dpayments.ts` uses placeholder endpoint paths, field names and signature header. Replace them with DPayments' real API spec.
- **Provider documents:** licence and ID photos are collected by phone for now; add file storage (e.g. S3-compatible) to upload them.
- **Provider accounts:** providers don't have their own logins yet; the brand handles their bookings and messages in the portal.
- **Cash commission:** decide the rule for providers whose cash commission isn't covered by card payouts (deadline to settle, or pausing listings above a limit).
- **Legal:** confirm SLTDA/NTC licensing for the platform itself, terms and conditions, privacy policy (Sri Lanka PDPA and UK GDPR), and the white-label revenue-share contract.
- **Prices in other currencies:** everything is in LKR for now; guests' cards are converted by the gateway.
