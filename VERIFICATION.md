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
