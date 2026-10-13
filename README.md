# Gracious Delights — Customer Website

Customer ordering PWA for Gracious Delights. Browse product categories, photos, prices and available stock; submit pickup/delivery requests and track their status from the same browser.

The kitchen workspace now lives in the separate repository https://github.com/forikm/GraciousDelightsAdmin and a separate Vercel project, gracious-delights-admin. Both sites use the existing Gracious Delights Neon database. Admin updates and customer requests sync through the database; there are no cross-site browser API calls.

This customer repository removes the admin screens and sign-in endpoint. Admin cookies are ignored here. Customers see only their own orders, published products and available stock. Private ingredient inventory and recipes are hidden.

Production customer website: https://gracious-delights-chi.vercel.app/.

Set DATABASE_URL and APP_ORIGIN in the customer Vercel project. Admin credentials belong only in the admin project. Never commit credentials. No migration or seed is needed for the current database.

Use Node 22. Run npm ci, npm test, npm run build, or npm start. Copy .env.example to .env.local for local database configuration. The build publishes only frontend assets, with the API served separately.

The 32 tests include two server origins sharing an isolated PostgreSQL engine, verifying customer requests reaching admin, order transitions, stock reservations, ingredient deductions, CSRF, ownership, copied-admin-cookie rejection, image serving and rate limits.

The installed PWA requires internet for current stock and ordering. Request tracking remains linked to the customer's browser cookies. Chrome controls native installation prompts; use Get the app or the browser installation menu.
