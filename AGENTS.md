# SETUVARA — PROJECT BOUNDARY

This repository is exclusively for Setuvara.

## Hard isolation rules

- Work ONLY inside the current Setuvara repository.
- Never read, modify, search, inspect, import from, or execute commands in parent directories or sibling repositories.
- Never touch any other project.
- Never reuse code, environment variables, credentials, database references, project IDs, deployment IDs, or configuration from another project.
- Do not run commands using `../` paths.
- Do not change files outside this repository.
- If a task appears to require access outside this repository, STOP and ask for confirmation.

## Connected infrastructure

Only use infrastructure explicitly belonging to Setuvara:

- GitHub repository: michelpronkk-oss/setuvara
- Vercel project: setuvara
- Supabase project: Setuvara

Before making infrastructure changes, verify that the target belongs to Setuvara.

## Product

Setuvara is a wallet-first digital identity and real-world connection network.

Core loop:

Identity
→ Mode
→ Share
→ Connect
→ Connection context
→ Stay connected
→ Share again

The product is NOT simply a link-in-bio or digital business card.

## Initial technology

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- Vercel

Do not add additional infrastructure unless it is required.

## Security

- Never expose Supabase secret/service-role credentials client-side.
- Use Row Level Security for exposed user data.
- Store secrets only in environment variables.
- Never commit `.env.local`.
- Prefer least-privilege access.

## First build priority

1. Foundation
2. Authentication
3. Identity + username
4. Profile links
5. Modes
6. Public profile
7. Share / dynamic QR
8. Guest Connect
9. Connections
10. Connection context
11. Wallet
12. Passport/rewards

Do not jump ahead unless explicitly requested.
