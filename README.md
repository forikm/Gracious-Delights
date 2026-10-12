# Gracious Delights

A responsive ordering PWA with a customer menu and authenticated kitchen workspace, prepared for Vercel and Neon PostgreSQL.

## Features

- Categories, product photos, PHP prices and available stock (maximum 19 physical units per product).
- Basket, pickup/delivery requests, order references, status tracking and pending-order cancellation.
- Admin sign-in, acceptance, ready/completed states, decline/cancel reasons visible to customers.
- Products, recipes, ingredient receipts/count adjustments, production and an activity log.
- Production consumes ingredients atomically. Orders reserve finished products; fulfillment deducts stock once. Decline/cancellation releases reservations.
- Shared database persistence across devices. Admin inbox refreshes every 15 seconds while open.
- Installable PWA shell. Ordering and admin changes require internet. Private API responses are never cached by the service worker.

## Setup

Follow [DEPLOYMENT.md](DEPLOYMENT.md) to connect your chosen Neon and Vercel accounts. No cloud account IDs or credentials are hardcoded.

```sh
npm ci
# Copy .env.example to .env.local and configure your database and admin identity.
npm run admin:password
npm run db:migrate
npm start
```

Use Node 22 (22.9 or later). Open http://localhost:4173 and choose Admin. Migration is explicit, idempotent and preserves existing data. A new database starts empty: add real ingredients and verified product prices/recipes. Old browser prototype data is not uploaded automatically.

```sh
npm test
npm run build
```

Tests exercise the rules and API against an isolated local PostgreSQL engine (PGlite). Test fixtures are never inserted by the application or migration. The optional `tests/browser-server.mjs` is a memory-only UI test harness; its test account is not a production account.

## Architecture

The frontend uses HTML/CSS/JavaScript. `/api/shop` is a Node.js Vercel Function. `pg` connects to Neon through a pooled `DATABASE_URL`; credentials never reach the browser. `db/001_initial.sql` defines the schema.

The shop aggregate is one PostgreSQL JSONB row. Every write holds `SELECT ... FOR UPDATE` on the same connection until commit, serializing recipe, inventory and order changes. Photos are separate bounded image records served by a content-addressed endpoint, requiring only Neon. This design fits a small shop. A large catalog or long order history should move to normalized tables, pagination and object storage before response sizes or lock contention become material.

One owner account is configured by environment variables. Passwords use salted scrypt hashes. Random admin sessions are stored as SHA-256 hashes, expire after eight hours and are revoked on logout. Changing the configured credentials invalidates existing sessions. Cookies are HttpOnly, SameSite=Strict and Secure on Vercel. Writes require the configured origin and JSON. Login/order submission limits are enforced in the database.

Guests receive an unguessable browser cookie. They can retrieve only their own orders, without private recipes or inventory. Admin can manage all requests across devices. Customers track requests in the browser where they ordered; cross-device customer login/recovery is not implemented. Clearing cookies loses self-service tracking, but admin can still locate the order by reference/contact details.

Payment is arranged with admin. Online payment processing, SMS/email/push notifications, delivery pricing and automatic pending-reservation expiry are not implemented. Admin must review the inbox and cancel abandoned requests.

## Content and backups

Photos and public contact details came from the [Gracious Delights Facebook page](https://www.facebook.com/graciousdelightsfoodandbeverage/). Confirm permission to publish photos, contact details, actual prices and recipes with the owner before taking orders. Sample menu data is for tests only, never live stock.

The admin JSON export is a readable record export, not a full restore system: image bytes and authentication/ownership details are not included. Use Neon backup/restore or pg_dump for complete recovery. Restrict access to exports containing customer details.

Only allowlisted static files go into `dist`. Server code, credentials and unrelated local documents are not public assets or repository deliverables.
