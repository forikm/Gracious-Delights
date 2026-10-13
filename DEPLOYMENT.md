# Separate customer and admin deployments

| Site | Website | Repository | Vercel project |
|---|---|---|---|
| Customers | https://gracious-delights-chi.vercel.app/ | https://github.com/forikm/Gracious-Delights | fita4/gracious-delights |
| Admin | https://gracious-delights-admin.vercel.app/ | https://github.com/forikm/GraciousDelightsAdmin | fita4/gracious-delights-admin |

The admin repository is public at the owner's explicit request. Database URLs, password hashes and deployment-tool credentials are excluded from source. Fetch-it Admin is a separate project and was not changed.

Both sites use the existing Gracious Delights Neon project little-sea-19309805, production branch, database neondb. No database reset or migration is needed for this separation. The restored six products and ingredient inventory remain in that database.

The customer API uses DATABASE_URL and APP_ORIGIN. It rejects admin login and ignores admin session cookies. Signed-out customers receive published products and only their own orders; recipes and ingredient inventory are private.

The admin API uses DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD_HASH, with the existing email and password. APP_ORIGIN can be the exact admin origin; when omitted, same-origin POST validation uses the deployment request host. Private state and all mutations require an authenticated admin. Customer checkout is rejected on the admin server. Sessions are host-only HttpOnly cookies, and private API responses are never cached.

Use Other framework, Node 22.x, npm run build and dist. vercel.json supplies the build settings. Configure secrets only in the correct project's production environment. Previews require separate database and credentials before they may accept real changes.

Customer and admin browsers contact only their own site's API. The shared database connects them, preserving atomic inventory and order transactions without cross-site cookies or CORS. The admin inbox refreshes every 15 seconds while open.

GitHub automatic deployment is not connected. Publish through the official Vercel CLI after verifying the intended team and project, or connect the appropriate repository later in that project's Git settings. Existing-deployment redeploys reuse source rather than fetching new GitHub commits.

To install either PWA, use Get the app or the browser's installation menu. On Android Chrome: menu → Install app / Install and create shortcut / Add to Home screen. On iPhone: Safari → Share → Add to Home Screen. The two apps install separately.

Before accepting real orders, review the prototype prices, quantities and recipes. Place a customer request on a separate browser or phone, then check the admin inbox, accept, mark ready, and complete it. Produce stock and verify ingredient deductions. Confirm decline/cancellation releases reservations. Orders require internet and must not be confirmed while offline.
