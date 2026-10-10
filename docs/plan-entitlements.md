# Global plan capabilities

Setuvara uses one global capability registry in
[`src/lib/billing/capabilities.ts`](../src/lib/billing/capabilities.ts). Plans
define a minimum tier; a registry entry also says whether the capability is
shipped. Product code should check a capability key rather than duplicate
plan-to-feature rules or inspect Dodo product IDs. The safe plan catalog is in
[`src/lib/billing/catalog.ts`](../src/lib/billing/catalog.ts).

## Access states

The effective plan comes from server-verified Dodo subscription state, resolved
by [`src/lib/billing/state.ts`](../src/lib/billing/state.ts). User metadata and
browser state cannot grant a plan.

- **Available** — the capability is live and the effective plan meets its
  minimum tier.
- **Locked** — the capability is live but needs a higher tier. An upgrade plan
  can be offered.
- **Unavailable** — the capability is marked future. It is disabled on every
  tier and has no upgrade action, including for Pro.

The client snapshot is informational; sensitive operations must also enforce
the capability on the server. Analytics SQL independently validates the
effective plan and query limits as defense in depth (see
[`billing.md`](./billing.md#database-boundaries)).

## Current live plan matrix

All prices are USD. Monthly and yearly amounts are provider-independent catalog
values; Dodo product IDs remain server-only.

| Plan | Price | Live plan capabilities |
| --- | ---: | --- |
| Free | $0 | Identity create/edit; Personal, Event, and Business Modes; public profiles, links/content, and core appearance; link sharing, standard QR, Quick QR, and Setuvara Tap; Tap device management and intents; Connections, Guest Connect, and private memories; Passport and standard progression; profile soundtrack; seven-day activity. |
| Plus | $6.99/month or $69/year | Everything in Free; Plus member badge; 30- and 90-day analytics history, source and Mode breakdowns, and view-to-Connection conversion. |
| Pro | $12.99/month or $129/year | Everything in Plus; Pro member badge; custom analytics ranges up to 730 days, connection journey funnel, device insights, and CSV export. |

The exact live capability keys are:

- **Free:** `identity.create`, `identity.edit`, `mode.personal`,
  `mode.event`, `mode.business`, `profile.public`, `profile.links`,
  `profile.content`, `appearance.core`, `share.link`, `share.qr`,
  `share.quick_qr`, `share.tap`, `tap.devices`, `tap.connect_intent`,
  `connections.core`, `connections.guest_connect`,
  `connections.private_memory`, `passport.core`,
  `passport.standard_progression`, `soundtrack.core`, and
  `analytics.basic_7d`.
- **Plus adds:** `identity.plus_badge`, `analytics.history_30d`,
  `analytics.history_90d`, `analytics.sources`, `analytics.modes`, and
  `analytics.conversion`.
- **Pro adds:** `identity.pro_badge`, `analytics.custom_range`,
  `analytics.funnels`, `analytics.device_insights`, and
  `analytics.csv_export`.

## Planned capabilities not available yet

Future entries are intentionally unavailable regardless of plan. Do not show
them as included benefits, enable them based on tier alone, or imply that
upgrading activates them.

- **Plus-level future:** `identity.remove_attribution`,
  `appearance.premium`, `appearance.advanced_controls`,
  `share.qr_premium`, `passport.premium_treatment`,
  `soundtrack.premium_treatment`, and `wallet.premium_appearance`.
- **Pro-level future:** `analytics.advanced_filters`, `domain.custom`,
  `actions.advanced`, `leads.capture`, `integrations.access`, and
  `webhooks.access`.
- **Free-level future:** `wallet.core`.

## Subscription state and downgrade behavior

The plan resolver uses these rules:

- An eligible `active` Plus or Pro subscription grants access. If cancellation
  is scheduled, access continues through the current period end.
- `past_due` grants access only through `past_due_ends_at`.
- `pending`, `on_hold`, `paused`, `cancelled`, `failed`, and `expired` do not
  grant paid access.
- No eligible subscription, an unknown plan, or an unknown product resolves to
  Free. When multiple rows qualify, the highest plan wins, then the latest
  period end.

Billing updates only billing provider state; a downgrade does not delete
identity data, Modes, profile content, links, connections, analytics records,
or earned Passport rewards. No premium-only appearance, QR, soundtrack, or
Passport configuration is currently persisted. The future premium settings in
the registry are not shipped, so there is no current premium configuration to
strip or transform during a downgrade.

## Paid badges and Setuvara Mark

The Plus and Pro member badges are derived from the effective subscription
tier. The Pro badge has its own presentation; it is not an earned Setuvara
Mark. Setuvara Mark is a separate Passport progression/reward concept and is
not a paid-plan benefit. Earning or selecting a Passport profile mark must not
change billing status or grant any paid capability.

## API shapes

- `GET /api/billing/catalog` returns plan metadata and each plan's currently
  available capability keys. It never returns provider credentials or Dodo
  product IDs.
- Authenticated `GET /api/billing/me` returns the effective plan and
  `canManageBilling`, plus the per-key capability snapshot. Each access entry
  contains `state`, `available`, `requiredPlan`, `upgradePlan`, `availability`,
  and `label`. This response is a UI contract, not a substitute for server
  enforcement.
- `GET /api/billing/public/[username]` only applies to published profiles and
  returns the limited public shape
  `{ entitlements: { memberBadge, removeSetuvaraBranding } }`. Unpublished or
  missing usernames return 404. No provider state, customer IDs, subscription
  IDs, dates, or billing history is public. The attribution-removal capability
  remains future/unavailable in the registry, and the public SQL function
  returns false for that legacy compatibility field.

Billing tables remain private to the server service role. The public SQL
entitlement function exposes only its two boolean outputs for published
profiles; see the RLS and function boundary notes in
[`billing.md`](./billing.md#database-boundaries).
