# Product analytics

Setuvara analytics are first-party aggregates stored in the Setuvara Supabase
project. The implementation has no third-party analytics SDK and does not
persist raw visitor IP addresses, email addresses, URL tokens, or User-Agent
strings. A request User-Agent is reduced in memory to `mobile`, `tablet`,
`desktop`, or `unknown`; only that coarse value may be stored for aggregate Pro
device insights.

## Plan access

- Free: seven calendar days of summary totals.
- Plus: seven, thirty, or ninety days, with daily totals and source/Mode
  breakdowns.
- Pro: up to 730 days, custom ranges, conversion/funnel reporting, coarse
  device classes when available, and CSV export.

The server derives the plan from the existing verified billing service. The
database RPC independently checks the current billing state and enforces the
same range and dimension limits. Missing or inactive billing state resolves to
Free. The browser cannot provide a plan, profile ID, or authorization claim.

## Event definitions

- Profile views are successful public profile renders. The profile owner and
  prefetches/crawlers are excluded. A source query parameter is an attribution
  label, not proof that a physical scan occurred.
- `qr_scans` counts profile arrivals tagged `source=qr`.
- `quick_qr_scans` counts successful Quick QR token resolutions. The later
  profile request is not counted again as a Quick QR scan.
- Tap scans are derived from the existing Tap event ledger. The analytics
  migration preserves that ledger and does not duplicate it.
- Connections count completed, persisted connections, not form submissions.
- First/repeat shares count successful owner copy/native-share actions or an
  explicit full-screen QR open. A completed connection is a separate outcome.
- Identity creation and first publication are database-derived milestones.
- Guest claims are counted only after an existing guest identity is actually
  claimed.

Only fixed event types and closed source/Mode/device enums are accepted. Event
rows and report aggregates contain no public visitor identifiers. Internal
analytics returns aggregate totals only and never returns member IDs or raw
event rows.

The private event table has RLS enabled, no table policies, and no direct grants
to `anon`, `authenticated`, or `service_role`. This is intentional: with no
policies, RLS denies direct row access, while the narrowly granted server-only
RPCs return aggregate results. Supabase's “RLS enabled, no policy” advisor notice
for this table reflects that deny-by-default design.

The three analytics indexes may initially appear as unused in Supabase's
performance advisor while the event history is small. They support owner/date,
event/date, and filtered owner/source/Mode report queries; review their usage
again after production traffic accumulates.

## Internal access

`/internal/analytics` is hidden from normal navigation and returns 404 unless
the signed-in, confirmed Supabase Auth user ID is present in the server-only
`SETUVARA_ANALYTICS_ADMIN_USER_IDS` environment variable. Configure a
comma-separated list of immutable Auth UUIDs in the local server environment
and the Setuvara Vercel project environment. Keep this variable server-only;
never prefix it with `NEXT_PUBLIC_`. An empty or invalid list disables access.
Editable user metadata, email addresses, and request headers are not used for
authorization.

## Validation

Run `npm run test:analytics` for plan range/capability rules. Local database
RLS, event-writer, and migration tests are in `supabase/tests/`; run them with
`supabase test db` after starting the repository's local Supabase stack.
