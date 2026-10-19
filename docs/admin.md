# Admin Control Center

The internal console at **admin.setuvara.com**. It runs inside this Next.js app: no separate project,
backend or database.

## How it is reached

- `src/proxy.ts` checks the host. On an admin host (`SETUVARA_ADMIN_HOSTS`, default
  `admin.setuvara.com`; ports ignored) every page path is rewritten into `src/app/admin/*`, and only
  `/api/admin/*` APIs answer. Everything else on that host 404s, so the admin domain never serves
  public profiles or app APIs.
- On every other host, `/admin/*` and `/api/admin/*` return 404. The admin layout and every admin
  API check the host again.
- Admin responses carry `noindex`, `no-store`, `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer`.
  `/robots.txt` on the admin host disallows everything.
- Supabase session cookies are host-only, so an app session on setuvara.com is not an admin session.

## Who gets in

Every page and API resolves the caller in this order and denies by default (`src/lib/admin/auth.ts`):

1. Supabase Auth user verified with the Auth server (`getUser`), email confirmed.
2. An active row in `private.admin_members` (read through `admin_access`, which also refuses banned
   or deleted accounts). Not user metadata, not an env var, not the client.
3. Two-step sign-in (TOTP, session at `aal2`). First visit walks the admin through setting it up.

Roles: `owner` (everything), `admin` (members, support, billing, health, audit), `analyst`
(overview, billing totals, health; no member records or emails). Writes from the browser must be
same-origin.

Grant, change or revoke access in the Supabase SQL editor (see the Access page for the statements).
The database writes the audit entry itself.

## Data

All reads go through `admin_*` SQL functions (migration `20261019180000_admin_control_center`):
`SECURITY DEFINER`, `search_path = ''`, executable by `service_role` only, called with the server key
from server code. They return aggregates or bounded pages and never return tokens, hashes, checkout
URLs or raw analytics events.

Paid plans are resolved in TypeScript with the app's own `selectEffectiveSubscription` /
`resolveBillingSnapshot`, so admin shows exactly what the product grants. Run-rate is list price
(`PUBLIC_PLAN_CATALOG`), not collected revenue; Dodo stays the record for payments.

## Audit

`private.admin_audit_log` is append-only (update, delete and truncate raise). It records admin
sign-ins, every member record view (logged before the data is read: no log, no data), screenshot
opens, Dodo checks, feedback status changes (same transaction as the change, with before/after),
and admin membership changes made in SQL.

The only write admin can make is moving a feedback note between open, reviewing and done.

## Local development

`supabase/config.toml` enables TOTP for the local stack. Set `SETUVARA_ADMIN_HOSTS=admin.localhost`,
start the app with `--hostname localhost` (Next rewrites need the request host and server host to
agree) and open `http://admin.localhost:3014`.
