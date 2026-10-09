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
- `npm run e2e:local` runs local signup, email confirmation, the three-Mode
  editor, media/link permissions, sharing, RLS, routing, and responsive flows
  in Playwright.

## Environment

Copy `.env.example` to `.env.local` and replace its placeholders with the
Setuvara Supabase project URL and publishable key. `.env.local` is ignored by
Git. The app uses the publishable key in browser and server-side SSR clients;
never put a secret or service-role key in this application.

Guest Connect uses a random HttpOnly browser session. The database stores only
its SHA-256 hash; guest email is never returned by the public API. Registered
Connect creates one symmetric relationship per user pair and appends an
Encounter for each share moment. A guest relationship can be claimed after
signup and email confirmation. Notes and Where You Met context are private to
their author, enforced by participant-aware RLS.

All six network tables have RLS enabled. Guest identity and session tables have
no direct API grants or policies; the application uses narrowly scoped
SECURITY DEFINER functions with a locked search path and explicit role grants.
Authenticated table access is limited to participant reads and each user’s own
notes and encounter context.

Supabase Advisor’s callable SECURITY DEFINER notices are expected for the
token-scoped guest Connect/status/detail functions and the authenticated
connect/claim functions. Their role grants are explicit and their search paths
are locked. The existing username-availability function returns only a boolean;
the existing `rls_auto_enable` event trigger is not an RPC-callable function.
Advisor also flags indexes as unused while the new network tables have no live
rows; retain them for the participant, claim, rate-limit, and foreign-key
queries they cover. Leaked-password protection is an existing Auth setting and
was not changed by the Connections migration.

Before using signup or the Identity editor, apply the SQL migrations in
`supabase/migrations/` to the dedicated Setuvara Supabase project. The Mode
migration preserves each existing Social Mode row and its links, renames it
Personal, and adds Event for existing and new profiles. Signup confirmation
uses `/auth/confirm` and the `token_hash` verification flow.
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
users or production keys.

## Project structure

```text
proxy.ts
supabase/
├── config.toml          # Local Supabase stack and Auth settings
├── functions/send-email/ # Supabase Auth Send Email Hook
├── migrations/
│   ├── 20261009020739_identity_vertical.sql
│   ├── 20261009025854_reserve_root_username_routes.sql
│   ├── 20261009053709_profile_modes_media.sql
│   ├── 20261009054048_public_mode_settings.sql
│   ├── 20261009133922_connections_network.sql
│   ├── 20261009133927_preserve_encounters_after_account_deletion.sql
│   └── 20261009134039_connections_fk_indexes.sql
└── templates/           # Local Auth email template
src/
├── app/
│   ├── app/identity/   # Multi-Mode editor, sharing, and actions
│   ├── auth/           # Auth callbacks and confirmation
│   ├── [username]/     # Published profile at the canonical root URL
│   ├── u/[username]/   # Permanent legacy redirect
│   └── ...             # Static, app, and health routes
├── components/profile/ # Shared profile renderer and normalized types
├── components/connections/ # Connect flow, connections list, private memory editor
└── lib/supabase/       # Browser, server, and session clients
```
