# Setuvara

Setuvara is a wallet-first digital identity and real-world connection network.
This repository includes the first Identity vertical: email authentication,
username reservation, Social and Business modes, profile links, publishing, and
public profiles.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- ESLint

## Requirements

- Node.js 22 or newer
- npm

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

## Environment

Copy `.env.example` to `.env.local` and replace its placeholders with the
Setuvara Supabase project URL and publishable key. `.env.local` is ignored by
Git. The app uses the publishable key in browser and server-side SSR clients;
never put a secret or service-role key in this application.

Before using signup or the Identity editor, apply the SQL migration in
`supabase/migrations/` to the dedicated Setuvara Supabase project. For email
confirmation, allow `/auth/callback` on the local and deployed app URLs in the
Supabase Auth redirect URL settings.

The non-product connectivity check is available at
`/api/health/supabase`. It checks the Supabase Auth health endpoint and does
not read or write database data.

## Project structure

```text
proxy.ts
supabase/
└── migrations/
    └── 20261009010000_identity_vertical.sql
src/
└── app/
    ├── app/identity/  # Signed-in Identity editor and actions
    ├── auth/callback/ # Email confirmation callback
    ├── login/
    ├── signup/
    ├── u/[username]/ # Published public profile
    ├── api/health/   # Non-product Supabase connectivity check
    ├── globals.css
    ├── layout.tsx
    └── page.tsx
src/lib/supabase/     # Browser, server, and session clients
```
