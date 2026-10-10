# Setuvara

Setuvara is a wallet-first digital identity and real-world connection network.
This repository includes Setuvara identity and its first connection-network
vertical: one canonical identity with Personal, Event, and Business Modes,
profile links and publishing, plus persistent Connections, encounter snapshots,
and participant-private notes and meeting context.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- ESLint

## Requirements

- Node.js 22 or newer
- npm
- Docker Desktop and Supabase CLI for local Auth E2E

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Scripts

- `npm run dev` starts the local development server.
- `npm run build` creates a production build.
- `npm run start` serves the production build.
- `npm run lint` runs ESLint.
- `npm run test:billing` tests the plan registry and subscription access rules.
- `npm run test:wallet` tests pass models, provider fail-closed readiness, stable QR reuse, and Google signing.
- `npm run test:analytics` tests plan-based analytics range and capability rules.
- `supabase db lint --local` lints local SQL migrations.
- `supabase test db` runs local database RLS and privilege checks.
- `npm run e2e:local` runs local signup, email confirmation, the three-Mode
  editor, media/link permissions, sharing, RLS, routing, and responsive flows
  in Playwright, plus the marketing route/navigation checks.
- `npm run e2e:marketing` runs the marketing route checks against the local app
  at `http://127.0.0.1:3014`.
- `npm run email:test` renders and checks shared auth and notification templates.
- `npm run email:preview` writes deterministic, non-dispatching email previews
  to `.next/email-previews/`.
- `npm run email:build-assets` regenerates the email mark from the existing
  Setuvara brand paths.

## Environment

Copy `.env.example` to `.env.local` and set the Setuvara Supabase URL and
publishable key. `.env.local` is ignored by Git. Browser and SSR clients use
only the publishable key. A server-only Supabase service-role key is required
for billing reconciliation and notification delivery; never prefix it with
`NEXT_PUBLIC_` or expose it to browser code. Billing provider configuration is
documented in [`docs/billing.md`](docs/billing.md).

Guest Connect uses a random HttpOnly browser session. The database stores only
its SHA-256 hash; guest email is never returned by the public API. Registered
Connect creates one symmetric relationship per user pair and appends an
Encounter for each share moment. A guest relationship can be claimed after
signup and email confirmation. Notes and Where You Met context are private to
their author, enforced by participant-aware RLS.

Mode-specific profile links use the typed registry in `src/lib/links/providers.ts`.
The registry drives provider suggestions, input validation and normalization,
server-side saves, and safe public rendering. Links store a provider identifier
and normalized destination; no provider OAuth is used.

All six network tables have RLS enabled. Guest identity and session tables have
no direct API grants or policies; the application uses narrowly scoped
SECURITY DEFINER functions with a locked search path and explicit role grants.
Authenticated table access is limited to participant reads and each user’s own
notes and encounter context.

Supabase Advisor’s callable SECURITY DEFINER notices are expected for the
token-scoped guest Connect/status/detail functions and the authenticated
connect/claim functions. The public one-click unsubscribe RPC is also
intentionally SECURITY DEFINER: it accepts only a single-use category-scoped
opaque token, exposes a boolean result, and has an empty search path. Role
grants are explicit and the existing username-availability function returns
only a boolean. Advisor may flag indexes as unused before production traffic
reaches their access paths; the notification delivery indexes cover queue
claiming and recipient history. Leaked-password protection is an existing Auth
setting and is not changed by the email system.

Apply the SQL migrations in `supabase/migrations/` to the dedicated Setuvara
Supabase project. The Mode migration preserves each existing Social Mode row
and its links, renames it Personal, and adds Event for existing and new
profiles. Signup confirmation uses `/auth/confirm` and the `token_hash`
verification flow. The Auth Send Email Hook sends directly through Resend;
notification delivery and its hosted scheduler are documented in
[`docs/email-notifications.md`](docs/email-notifications.md).
Published profiles use the canonical root URL
`https://setuvara.com/[username]`; the legacy `/u/[username]` path permanently
redirects there.

The non-product connectivity check is available at
`/api/health/supabase`. It checks the Supabase Auth health endpoint and does
not read or write database data.

## Local Auth E2E

Start the Setuvara local Supabase stack from this repository:

```bash
supabase start --exclude vector
```

Install Chromium into the ignored repository-local browser cache, then run the
E2E flow:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = ".playwright-browsers"
npx playwright install chromium
npm run e2e:local
```

The runner checks the Git root and local Supabase URL, builds the app with the
local publishable key, starts a temporary production server on port 3014, and
reads confirmation emails from Mailpit. Test accounts use generated
`example.test` addresses and passwords; the local flow does not use hosted
users or production keys. It also verifies notification preference RLS,
single-use unsubscribe behavior, event idempotency, recap grouping, and
recipient resolution from the confirmed Auth user at delivery time.

The Home checks also cover real empty/progressed Connections and Passport,
Free/Plus/Pro account states, remembered Modes, sharing and keyboard focus,
and 360/390/430/1280/1440/1728/1920px layouts. Billing fixtures are local only;
portal success/error navigation and native Share dispatch are tested at the
HTTP/browser API boundaries without calling Dodo or opening an OS share sheet.
The runner supplies the local server key in memory for server-side billing
reads. QA screenshots stay in the ignored `.next/home-qa/` directory.

## Setuvara Wallet

`/app/wallet` prepares one identity-scoped Apple Wallet pass or Google Wallet
Generic Pass from the current Equipped Mode and the existing Quick Share URL.
Provider actions remain unavailable until server-side Apple or Google Wallet
configuration is complete. Read [docs/wallet.md](docs/wallet.md) for provider
setup, security boundaries, and local validation commands.

## Signed-in Home

`/app` uses desktop top navigation and mobile bottom navigation. Account,
notification preferences and billing are in the avatar menu. `/app/identity`
keeps its own full-screen editor. Home's Mode stage shares the current
root-profile URL conventions with Identity, and remembers the last selected
Mode; an explicit valid `?mode=` takes precedence on arrival.

People and Passport stream behind separate loading boundaries and use the
existing RLS-scoped Connections data and Passport RPC/reward registry. Plan
state comes from the existing server-only billing service. Hosted Home media
uses signed 96px avatar and 1600px stage transforms; local stacks without
imgproxy use the ordinary signed Storage path. No schema or billing-provider
behavior changes are required for this Home integration.

## Project structure

```text
proxy.ts
supabase/
├── config.toml          # Local Supabase stack and Auth settings
├── functions/
│   ├── _shared/         # Shared React Email renderer and tests
│   ├── send-email/      # Supabase Auth Send Email Hook
│   └── dispatch-notifications/ # Durable outbox worker
├── migrations/
│   ├── 20261009020739_identity_vertical.sql
│   ├── 20261009025854_reserve_root_username_routes.sql
│   ├── 20261009053709_profile_modes_media.sql
│   ├── 20261009054048_public_mode_settings.sql
│   ├── 20261009133922_connections_network.sql
│   ├── 20261009133927_preserve_encounters_after_account_deletion.sql
│   ├── 20261009134039_connections_fk_indexes.sql
│   ├── 20261009140904_passport_progression.sql
│   ├── 20261009140956_passport_policy_indexes.sql
│   ├── 20261009143858_link_provider_types.sql
│   ├── 20261009181057_setuvara_email_notifications.sql
│   ├── 20261009181121_setuvara_email_unsubscribe_user_index.sql
│   ├── 20261010182039_wallet_pass_infrastructure.sql
│   └── 20261010193000_wallet_registration_fk_index.sql
├── operations/          # Hosted-only Setuvara scheduler setup
└── templates/           # Local Auth email template
src/
├── app/
│   ├── (marketing)/    # Shared public marketing shell and static pages
│   ├── app/identity/   # Multi-Mode editor, sharing, and actions
│   ├── auth/           # Auth callbacks and confirmation
│   ├── [username]/     # Published profile at the canonical root URL
│   ├── u/[username]/   # Permanent legacy redirect
│   └── ...             # Static, app, and health routes
├── components/links/   # Provider picker and reusable provider marks
├── components/marketing/ # Shared marketing navigation, footer, and page primitives
├── components/profile/ # Shared profile renderer and normalized types
├── components/connections/ # Connect flow, connections list, private memory editor
├── components/app/wallet/ # Owner Wallet surface
└── lib/
    ├── links/          # Central provider registry and canonical normalization
    ├── wallet/         # Server-only Apple/Google Wallet integration and pass models
    └── supabase/       # Browser, server, and session clients
```

The public marketing foundation uses a shared header, accessible mobile menu,
footer, route-specific canonical/social metadata, and generated Setuvara social
image. Its initial routes are `/`, `/pricing`, `/events`, and `/teams`. Profile
routes remain outside the marketing layout.
