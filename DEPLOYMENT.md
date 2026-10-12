# Connect your Neon and Vercel accounts

## Current production deployment

Published October 13, 2026: **https://gracious-delights-chi.vercel.app/**.
Admin: **https://gracious-delights-chi.vercel.app/#admin/products**.

- Vercel workspace: `fita4`; separate project: `gracious-delights`. Fetch-it Admin was not changed.
- Neon project: `Gracious Delights` (`little-sea-19309805`), production branch, database `neondb`. Initial schema applied. At the owner's request, the six prototype products, prices, stock quantities, recipes, and 13 ingredients were restored on October 13, 2026. Opening batches already deduct their ingredients. Review these example values before accepting real orders.
- Production environment has `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `APP_ORIGIN`. Credentials are not stored in this repository.
- Current application source deployed from commit `1b3ced4` through the official Vercel CLI. Deployment: `EZcJPtkHkPGzHjDqaJ1pbrsqvn5N`. Initial deployment used a source archive.
- **GitHub automatic deployment is not connected.** The signed-in Vercel account's GitHub integration could not access `forikm/Gracious-Delights`. This local folder is now linked specifically to `fita4/gracious-delights`. Future code changes need another source deployment through the CLI, or connection of this repository under this project's Git settings. Verify the target before deploying. Redeploying an existing deployment reuses its source; it does not fetch new GitHub commits.
- Complete kitchen setup and the phone-to-admin order checks below before accepting real orders.

This repository builds without attaching a cloud account. Follow these steps when ready to publish.

## 1. Prepare Neon

1. Select your intended project and branch. Use separate branches/databases for preview testing and production.
2. Copy the pooled PostgreSQL connection string (hostname contains `-pooler`). Use `sslmode=verify-full` for certificate and hostname verification. The entire URL is a secret.
3. Copy `.env.example` to `.env.local` and set `DATABASE_URL`. Never put it in GitHub source, chat, frontend files or a `VITE_`/`NEXT_PUBLIC_` variable.
4. Run `npm ci` and `npm run db:migrate`. Alternatively, execute the complete `db/001_initial.sql` in the SQL editor for the intended branch. Repeating it preserves existing records.

The database starts empty. No sample prices, recipes, stock or orders are imported.

## 2. Configure admin access

1. Set `ADMIN_EMAIL` to the owner's sign-in email.
2. Run `npm run admin:password` in a local terminal. Enter a strong 12–200 character password twice; input is hidden.
3. Copy the generated `scrypt:...` value to `ADMIN_PASSWORD_HASH` in your environment. Save the password in your password manager. Only the hash goes in configuration.

There is no default production password or public registration. To recover access, generate a new hash, replace the environment variable and redeploy. Existing sessions then become invalid. Changing the email also revokes sessions.

## 3. Import GitHub into Vercel

1. Import `forikm/Gracious-Delights` in your chosen Vercel account.
2. Set Framework Preset to **Other**, Root Directory to repository root, Node.js to **22.x**, Build Command to `npm run build`, Output Directory to `dist`. `vercel.json` supplies build/output settings.
3. Add these server environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string for this environment |
| `ADMIN_EMAIL` | Owner's sign-in email |
| `ADMIN_PASSWORD_HASH` | Generated scrypt hash, unchanged |
| `APP_ORIGIN` | Exact canonical HTTPS origin, e.g. `https://your-project.vercel.app`, without a trailing slash |

Locally use `APP_ORIGIN=http://localhost:4173`. For Vercel previews, omit `APP_ORIGIN` to use the deployment request host, or supply the exact preview URL. Keep preview credentials/database separate from production. Environment changes require a new deployment. These variables are server-only.

4. When you choose to deploy, check build logs and open the generated HTTPS URL. If it differs from `APP_ORIGIN`, correct the value and redeploy. With a custom domain, set the canonical origin and redirect alternate hostnames to it.
5. Migrations do not run during the build; this prevents preview builds from accidentally modifying production. Run step 1 on the intended database first.

## 4. Set up the kitchen

1. Sign in through Admin.
2. Add ingredients and actual opening quantities in grams, milliliters or pieces.
3. Add products with verified photos, categories, prices, descriptions and recipes per sellable unit. Initial stock consumes ingredients, so record actual production only.
4. Check recipes and prices. Products may hold at most 19 units.
5. Confirm pickup arrangements, operating hours, delivery service area/fees and payment with customers. The app submits requests; admin handles these arrangements.

## 5. Verify before accepting real orders

- Order on a phone, with admin signed in on a different device/browser. The request should appear within 15 seconds.
- Accept, mark ready and complete it. Finished stock decreases once; ingredients are unchanged by fulfillment.
- Decline another request and confirm its reservation is released.
- Produce stock and verify exact ingredient deductions. Insufficient ingredients must leave everything unchanged.
- Check that signed-out visitors cannot see inventory or other customers' details.
- Reload both devices to check persistence. Disconnect the customer device: it must not confirm an offline order.
- Install the PWA from HTTPS through the browser menu (Safari Share → Add to Home Screen on iPhone).

Local tests do not replace this final check against the actual Neon branch and Vercel deployment.

## Operations

On Android Chrome, the website offers a visible **Get the app** panel, including narrow phones. If Chrome supplies its install event, the button opens the native prompt. Otherwise it shows instructions for Chrome's menu → **Install app**, **Install and create shortcut**, or **Add to Home screen**. Chrome controls prompt availability; the website cannot force an automatic browser dialog. The install panel is hidden when the app is already open in standalone mode. On iPhone, use Safari → Share → **Add to Home Screen**.

The inbox refreshes while open; background SMS/email notifications are not included. Review pending orders and cancel abandoned requests to release stock. Configure Neon backup retention for your records. Uploaded photos are capped at 800 KB after compression and stored in PostgreSQL; large-scale usage should move images to object storage.

If the API says the shop is unavailable, check environment settings, migration completion and function logs. The app fails closed when the database is missing rather than accepting unsaved orders.

References: [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js), [Neon connection setup](https://neon.com/docs/get-started/connect-neon), [node-postgres transactions](https://node-postgres.com/features/transactions).
