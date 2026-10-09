# Setuvara billing foundation

Billing is server-only infrastructure. The current product does not gate any
features on plan entitlements. The typed catalog and entitlement registry live
in `src/lib/billing/`; provider state is synchronized only from signed Dodo
subscription webhooks and canonical Dodo subscription retrieval.

## Local configuration

Use Dodo test mode for local development. Copy `.env.example` to `.env.local`
and configure test-mode values from the Setuvara Supabase and Dodo projects.
Production uses the already configured Dodo LIVE API key, webhook signing key,
and live product IDs in the production server environment; do not create or
substitute duplicate products.

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; required for private billing state)
- `NEXT_PUBLIC_APP_URL` (`http://127.0.0.1:3014` locally or `https://setuvara.com` in production)
- `DODO_PAYMENTS_API_KEY` and `DODO_PAYMENTS_WEBHOOK_KEY`
- `DODO_PAYMENTS_ENVIRONMENT` (exactly `test_mode` locally and `live_mode` in production; missing, malformed, or mismatched values disable billing)
- the four monthly/yearly Plus/Pro Dodo product IDs

The existing live products must match the canonical USD prices in
`src/lib/billing/catalog.ts`: Plus $6.99/month or $69/year, Pro $12.99/month or
$129/year. Do not create duplicates or replace the configured live IDs. The
checkout route retrieves and validates each selected product against this
catalog before creating a session. `npm run billing:validate-live` performs
read-only product retrievals and never creates checkout sessions. It requires
an exact `live_mode` setting and four distinct configured product IDs.

Register `POST https://setuvara.com/api/webhooks/dodo` in the Dodo dashboard
with subscription lifecycle events enabled. For local end-to-end tests, forward
Dodo test webhooks to `http://127.0.0.1:3014/api/webhooks/dodo` using a local
webhook forwarder and the matching test signing key. The handler verifies the
raw request body with the official Dodo SDK before processing any event.

Keep all provider keys and the Supabase service-role key in server-only
environment variables. Never commit them or put them in `NEXT_PUBLIC_*`.
Production billing is accepted only with the exact `live_mode` setting. Local
and non-production environments are accepted only with exact `test_mode`;
neither environment silently defaults when the mode is absent or malformed.

## API contracts

- `GET /api/billing/catalog` returns the safe canonical USD plan catalog.
- `GET /api/billing/me` returns the signed-in confirmed user's plan snapshot
  and complete boolean entitlement map.
- `GET /api/billing/public/[username]` returns only `verifiedBadge` and
  `removeSetuvaraBranding` for an existing published root profile; unpublished
  and nonexistent usernames are both 404.
- `POST /api/billing/checkout` accepts only `{ "plan": "plus" | "pro",
  "interval": "monthly" | "yearly" }` with a UUID `Idempotency-Key` header.
  The caller cannot choose a user, email, customer, or product ID.
- `POST /api/billing/portal` creates a portal link for the authenticated user's
  mapped Dodo customer.
- `POST /api/webhooks/dodo` verifies Dodo's Standard Webhooks signature, stores
  event IDs durably, ignores non-subscription events, fetches the canonical
  current subscription from Dodo, then applies ordered state synchronization.

Billing tables have RLS enabled and no `anon` or `authenticated` table grants.
Only the server service role can access them. The public SQL function is the
single intentional exception: its locked-down `SECURITY DEFINER` body exposes
only two booleans for a published profile, never billing rows, IDs, or dates.
Supabase's advisor may flag the four policy-free billing tables even though
they have no client grants; this is intentional deny-by-default access. It may
also flag the public entitlement RPC because it is deliberately callable by
visitors, and the subscription lookup index as unused while the new billing
tables are empty. The RPC is locked to an empty search path and returns only
the two booleans above; the index supports per-user subscription lookups.

## Local validation

Start the local Supabase stack from this repository, reset it to apply all
checked-in migrations, then run database lint and the security tests:

```powershell
supabase start --exclude vector
supabase db reset --local
supabase db lint --local
supabase test db
npm run test:billing
```

The database security tests are in `supabase/tests/billing_security.sql`.
