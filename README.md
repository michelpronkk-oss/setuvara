# Setuvara

Setuvara is a wallet-first digital identity and real-world connection network.
This repository includes the first Setuvara product vertical: one canonical
identity with Personal, Event, and Business Modes, profile links, publishing,
private profile media, a shared profile renderer, and Mode-aware sharing.

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
│   └── 20261009054048_public_mode_settings.sql
└── templates/           # Local Auth email template
src/
├── app/
│   ├── app/identity/   # Multi-Mode editor, sharing, and actions
│   ├── auth/           # Auth callbacks and confirmation
│   ├── [username]/     # Published profile at the canonical root URL
│   ├── u/[username]/   # Permanent legacy redirect
│   └── ...             # Static, app, and health routes
├── components/profile/ # Shared profile renderer and normalized types
└── lib/supabase/       # Browser, server, and session clients
```
