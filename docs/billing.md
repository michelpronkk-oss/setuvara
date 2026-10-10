# Billing and plan entitlements

Setuvara billing uses Dodo for checkout and subscription management. Effective
plans are derived from verified provider subscription state; clients cannot
assign a plan or edit provider state. The canonical capability policy and the
current Free, Plus, and Pro matrix are documented in
[plan-entitlements.md](./plan-entitlements.md).

## Plan state and lifecycle

`src/lib/billing/state.ts` is the application plan resolver. It considers only
Plus or Pro subscription rows whose provider status grants access. No eligible
row resolves to Free; if multiple rows are eligible, Pro takes precedence,
then the row with the latest period end. A missing billing record never reads
plan information from user metadata. `canManageBilling` is separate from plan
access: it indicates that subscription history exists, not that a paid plan is
active.

- `active` grants access. If cancellation is scheduled, access ends at the
  current period end; otherwise the active state grants access until Dodo
  reports a lifecycle change.
- `past_due` grants access only through `past_due_ends_at`.
- `pending`, `on_hold`, `paused`, `cancelled`, `failed`, and `expired` do not
  grant paid access.
- Unknown or unconfigured products map to no paid plan.

The Dodo webhook verifies the signed raw request, durably claims the event ID,
and retrieves the canonical subscription from Dodo before synchronizing state.
Stale synchronization attempts are rejected by the database. This keeps
webhook payload claims from directly granting an entitlement.

Plan changes update billing state; they do not delete profiles, Modes, links,
connections, analytics events, or earned Passport rewards. No premium-only
appearance, QR, soundtrack, or Passport configuration is currently persisted.
Future paid settings must preserve saved user data when access changes.

## Dodo configuration

Use Dodo test mode locally and Dodo LIVE in production. Copy `.env.example` to
`.env.local` and configure the Setuvara local test values there. Production
uses the existing live API key, webhook signing key, and live product IDs; do
not create duplicates or replace those IDs.

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, for private billing state)
- `NEXT_PUBLIC_APP_URL` (`http://127.0.0.1:3014` locally or
  `https://setuvara.com` in production)
- `DODO_PAYMENTS_API_KEY` and `DODO_PAYMENTS_WEBHOOK_KEY` (server-only)
- `DODO_PAYMENTS_ENVIRONMENT` (`test_mode` locally; `live_mode` in production)
- the four monthly/yearly Plus/Pro Dodo product IDs (server-only)

Missing, malformed, or runtime-mismatched environment values disable billing;
production never defaults to test mode. The configured live products must
match the catalog prices: Plus $6.99/month or $69/year, Pro $12.99/month or
$129/year. Checkout retrieves and checks the selected product before creating
a checkout session. `npm run billing:validate-live` performs read-only
retrievals of the configured live products and does not create checkout
sessions or charge a customer.

Register `POST https://setuvara.com/api/webhooks/dodo` in Dodo with subscription
lifecycle events enabled. For local integration tests, forward Dodo test
webhooks to `http://127.0.0.1:3014/api/webhooks/dodo` using a local forwarder
and the matching test signing key. Keep provider keys and the Supabase
service-role key in server-only environment variables; never place them in
`NEXT_PUBLIC_*` or tracked files.

## API contracts

- `GET /api/billing/catalog` returns the public USD plan catalog, including
  capability keys available on each plan. It does not return Dodo product IDs.
- `GET /api/billing/me` requires a confirmed signed-in user and returns
  `billing: { plan, canManageBilling }` plus the registry-derived entitlement
  snapshot. Each capability includes its availability state, required plan,
  upgrade plan when applicable, and label. Provider IDs and period dates stay
  private.
- `GET /api/billing/public/[username]` returns only
  `{ entitlements: { memberBadge, removeSetuvaraBranding } }` for an existing
  published username. Unpublished and nonexistent profiles are both 404. The
  public SQL function returns only two booleans, never billing rows, IDs, or
  dates. `removeSetuvaraBranding` remains false for compatibility while
  attribution removal is marked future/unavailable in the capability registry.
- `POST /api/billing/checkout` accepts only `{ "plan": "plus" | "pro",
  "interval": "monthly" | "yearly" }` and a UUID `Idempotency-Key` header.
  Callers cannot choose a user, email, customer, or product ID.
- `POST /api/billing/portal` creates a portal link for the confirmed user's own
  mapped Dodo customer.
- `POST /api/webhooks/dodo` verifies Dodo's webhook signature, stores event IDs
  durably, ignores unrelated events, retrieves canonical subscription state,
  and applies ordered synchronization.

## Database boundaries

`billing_customers`, `billing_subscriptions`, `billing_checkout_attempts`, and
`billing_webhook_events` have RLS enabled, with table access revoked from
`anon` and `authenticated`. Only the server service role can read or mutate
these tables. The limited public entitlement RPC is the intentional exception
and is locked to an empty `search_path`.

Analytics has an additional database-side plan check. The report SQL function
recalculates the effective plan from `billing_subscriptions` using
`billing_subscription_has_access`, compares it with the caller-supplied plan,
and enforces the plan's history/range/filter limits before returning an
aggregate. This is defense in depth alongside the server capability registry;
the SQL policy must be kept aligned when analytics entitlements change.

## Validation commands

From the Setuvara repository root, the focused local billing checks are:

```powershell
npx supabase start --exclude vector
npx supabase db reset --local --no-seed
npx supabase db lint --local
npx supabase test db --local
npm run test:billing
npm run test:billing:integration
```

The integration script runs local database tests and authenticated API route
tests. It requires the local Setuvara Supabase stack and uses only its
ephemeral local test accounts. For broader engineering checks, run:

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm audit --omit=dev
git diff --check
```

`npm run smoke:billing:hosted` is a separate hosted Setuvara smoke test; verify
the target project before running any hosted operation. It does not replace
local SQL/RLS tests. `npm run billing:validate-live` is read-only and checks
the four configured LIVE Dodo products.
