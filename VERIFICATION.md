# Verification

Vercel/Neon preparation checked locally on October 12, 2026.

- `npm test`: 32 tests pass, including an HTTP integration flow against PGlite's local PostgreSQL engine.
- Integration checks: isolated customers, admin login/logout, forged roles, cross-origin rejection, private field filtering, persistent API state, idempotent checkout retry, stock reservations, competing requests, stale admin revisions, rollback, completion, production, images and rate limits.
- `npm run build`: creates allowlisted static output without credentials or server source.
- Browser: customer checkout returned an order reference; admin required sign-in and displayed the same database order.
- Domain tests: rounding, ingredients, recipes, price changes, hidden products, quantities and order transitions.

The API tests use a real SQL engine locally, not a live Neon connection. The local engine queues connections; locking across production PostgreSQL connections still needs the deployment smoke test in DEPLOYMENT.md. Cloud configuration, live migration and public deployment were not performed for this repository-only handoff.
