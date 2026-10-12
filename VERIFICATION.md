# Verification

Vercel/Neon preparation checked locally on October 12, 2026.

- `npm test`: 32 tests pass, including an HTTP integration flow against PGlite's local PostgreSQL engine.
- Integration checks: isolated customers, admin login/logout, forged roles, cross-origin rejection, private field filtering, persistent API state, idempotent checkout retry, stock reservations, competing requests, stale admin revisions, rollback, completion, production, images and rate limits.
- `npm run build`: creates allowlisted static output without credentials or server source.
- Browser: customer checkout returned an order reference; admin required sign-in and displayed the same database order.
- Domain tests: rounding, ingredients, recipes, price changes, hidden products, quantities and order transitions.

The API tests use a real SQL engine locally. The local engine queues connections; locking across production PostgreSQL connections still needs the full deployment smoke test in DEPLOYMENT.md.

## Live deployment checks — October 13, 2026

- Vercel production deployment `4w3oPDwfts3ys2SvTFWvSFTy3sNz` reached Ready and serves https://gracious-delights-chi.vercel.app/.
- Applied the initial schema to the authorized empty Neon database; verified all four tables exist.
- Public API returned HTTP 200, `admin: false`, an empty catalog and no orders, with `Cache-Control: no-store`.
- Signed-out admin mutation returned 403; incorrect login returned 401; a cross-origin mutation returned 403.
- PWA manifest and service worker returned HTTP 200 with appropriate content types.
- Browser displayed the storefront and protected admin sign-in form. The owner successfully signed in with their chosen password; the live Products workspace showed "Connected to kitchen".
- No sample products or orders were inserted. A complete real-product order/production flow still requires the owner's kitchen setup and checks in DEPLOYMENT.md.

## Catalog restoration and mobile installation — October 13, 2026

- Owner explicitly requested restoration of the prototype prices, quantities, and recipes. An atomic update applied only while products, ingredients, and orders were empty; existing nonempty shop data could not be overwritten.
- Live API confirmed six products with stock 8, 3, 2, 12, 5, and 0, and continued hiding ingredient inventory from signed-out customers.
- Added a prominent install panel and removed narrow-screen hiding of the install control. Tested panel visibility and manual-install instructions in a 320-pixel browser viewport. Actual Android Chrome native install-dialog availability is controlled by Chrome and still needs confirmation on the owner's phone.
- Re-ran all 32 tests successfully and built the frontend. Local preview was used only for installation UI checks; its database was not configured.
- Published deployment `EZcJPtkHkPGzHjDqaJ1pbrsqvn5N` reached READY at the existing production domain. Public requests confirmed the updated install panel, script, and v4 service worker. PWA icons served with valid 192×192 and 512×512 dimensions. The owner’s signed-in admin workspace displayed all six products and 30 units of stock.
