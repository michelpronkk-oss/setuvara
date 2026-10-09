# Setuvara

Setuvara is a wallet-first digital identity and real-world connection network.
This repository contains the application foundation; product functionality and
database schema will be added in later steps.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- ESLint

## Requirements

- Node.js 20.9 or newer
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

The non-product connectivity check is available at
`/api/health/supabase`. It checks the Supabase Auth health endpoint and does
not read or write database data.

## Project structure

```text
src/
└── app/
    ├── globals.css   # Global styles and Tailwind entry point
    ├── layout.tsx    # Root document and metadata
    └── page.tsx      # Foundation landing page
```
