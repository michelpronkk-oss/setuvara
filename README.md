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

No application environment variables are required yet. Copy `.env.example` to
`.env.local` when local configuration is introduced. Keep secrets in local
environment files and never commit them.

## Project structure

```text
src/
└── app/
    ├── globals.css   # Global styles and Tailwind entry point
    ├── layout.tsx    # Root document and metadata
    └── page.tsx      # Foundation landing page
```
