# Connect Chat implementation and release controls

This branch starts from release commit `baefbf5810e6363e4c0b97b9e63029be07084325`. The existing 53 migrations end at `20261019200000_site_page_views`; `20261020120000_connect_chat.sql` is migration 54. It has not been applied to a hosted environment. The ChatGPT Supabase connection reportedly found all 53 versions on Setuvara project `wizqtlgnuiicvpycvhhc`; the Codex environment still receives HTTP 403, so live schema and migration state must be independently checked before any hosted operation.

## Product contract

- An account has one inbox across Modes. A registered Connection permits one text request for a pair. A guest or an unrelated account cannot request or read chat.
- The recipient must explicitly accept before ordinary messages can be sent. A reciprocal request never accepts. A decline stops the original requester from repeating; the recipient may later initiate a new request.
- Accepted chat survives ordinary removal of the underlying Connection. Either participant can block; a block stops sends and requests in both directions without disclosing who blocked whom. Disabling requests affects new requests, not accepted conversations.
- Hiding a conversation changes only that participant's inbox state. Account deletion cascades the shared conversation and messages for both participants. A separately copied, bounded report snapshot can remain for safety review.
- Text only, no attachments, presence, typing, read receipts, external notifications, message analytics, or per-Mode inboxes in this release.

## Architecture

The browser uses the authenticated Supabase client for participant reads and narrow RPCs. It has no table write grants. Pair and client IDs make requests and sends unique; database transactions, advisory locks and row locks order concurrent sends, requests and blocks. The sender's rate check is serialized across pairs. Participant RLS protects reads. Case evidence lives in `private.chat_reports`, outside the Data API, with an explicit reviewer allowlist in addition to existing admin role and MFA. Evidence opening writes to the immutable admin audit log. Report bodies are never sent to ordinary analytics or logs.

`chat_conversations` is the Realtime wake-up source. The client subscribes to conversation changes for its two participant columns and reloads the authoritative inbox and messages with sequence keysets after events, reconnects and visibility changes. The sender reuses the same `client_id` on retry. The UI shows pending, sent and failed states.

The database migration installs `private.chat_runtime.enabled = false`. Participant RLS and all user-facing write RPCs stay closed until an approved SQL operation enables it. The application also requires server environment `CONNECT_CHAT_ENABLED=true` to show entry points and the route. Deploy the migration first, then the application with the flag absent, then conduct controlled checks. Neither flag is a substitute for the other.

## Local verification

Use an **isolated** Setuvara local Supabase stack. Do not reset a shared local database or use the hosted project for tests. Apply all 54 migrations. For the E2E scripts, in that isolated database run:

```sql
update private.chat_runtime set enabled = true, updated_at = now() where singleton;
```

Run `npx supabase test db` for pgTAP authorization and deletion checks **before** that update (the chat test asserts the shipped gate is closed and opens it inside its own rolled-back transaction), then enable it for the scripts below. The local multi-account flow is `npm run e2e:chat`, with `CHAT_TEST_LOCAL=1`, `CHAT_TEST_SUPABASE_URL`, `CHAT_TEST_PUBLISHABLE_KEY`, and `CHAT_TEST_SECRET_KEY` pointing only to that isolated local stack. Start the Next app with `CONNECT_CHAT_ENABLED=true` and the same local Supabase URL/key, then run `npm run e2e:chat:ui` with `CHAT_TEST_APP_URL` set to its local URL. Both scripts reject nonlocal URLs. The browser script checks request, acceptance, realtime delivery, reporting, preferences, blocking, and horizontal overflow at mobile and desktop sizes. Run `npx next typegen`, `npx tsc --noEmit --incremental false`, focused lint, and a production build. Inspect member and reviewer flows visually before release.

## Hosted release sequence — approval required

1. Independently verify the Setuvara project ref, environment, live schema, and all 53 previously applied migrations in the Codex execution environment. Resolve any drift before continuing.
2. Obtain privacy approval for the 90-day post-closure report period, what happens to open cases, legal holds, the Connection deletion notice correction, and the published wording. Establish and test a daily purge schedule calling `public.chat_purge_closed_reports()` as the database owner or service role. No schedule is installed by this branch.
3. Provision named safety reviewers only through a reviewed insert into `private.chat_report_reviewers`, after existing admin enrollment and MFA. Confirm list, case open, status update, audit records, and least-privilege denial. Do not add general admins by default.
4. Apply migration 54 with `private.chat_runtime.enabled` remaining false. Check RLS, grants, indexes, publication, RPCs and migration ledger. Deploy the application with `CONNECT_CHAT_ENABLED` absent. Confirm normal Setuvara flows and that chat requests and direct RPC calls remain closed.
5. After explicit launch approval, enable `private.chat_runtime` in a reviewed SQL transaction, then promptly deploy with `CONNECT_CHAT_ENABLED=true`. The database gate opens first so the visible UI never points at disabled RPCs. Smoke test with consented test accounts: eligibility, request, acceptance, concurrent sends and retries, decline, block, report, hide, unread, offline recovery, account deletion and report retention. Monitor errors, latency and abuse volume without recording message bodies.

## Rollback

Set `private.chat_runtime.enabled=false` first to stop participant reads and writes, then disable `CONNECT_CHAT_ENABLED` in the application. Keep the migration and data in place while investigating; reverting the migration would destroy chat data and is not an operational rollback. The reviewer tools and retention maintenance must continue for existing reports while messaging is disabled. Re-enable only after the incident is resolved and the two gates are deliberately restored.

## Verified locally (2026-10-20)

On an isolated local Supabase stack (CLI 2.120, Postgres 17) started from this branch:

- All 54 migrations apply from scratch; `apply-connect-chat.sql` (the hosted-release file) applies on top of the 53 and its preflight refuses a second run.
- `npx supabase test db`: `connect_chat_security.sql` passes (runtime gate on reads and writes, consent, retries, reciprocal requests, blocks, reports, unrelated and unconnected accounts, unread totals, display-name sync, deletion and purge). The only failure is `creator_security.sql` test 35, which fails identically on `main` without this migration.
- `npm run e2e:chat` (multi-account, concurrency and retry) and `npm run e2e:chat:ui` (phone 390 and desktop 1440: request, unread badge, accept, realtime delivery, a 20-message burst staying scrolled to the newest, Back/Forward between inbox and thread, report, preferences, block, no horizontal overflow) pass. Set `E2E_CHROMIUM` to a local Chromium if Playwright's bundled one is missing and `CHAT_TEST_SHOTS` to a folder to keep screenshots.
- With `CONNECT_CHAT_ENABLED` unset the People page has no Messages entry, the shell makes no chat calls and `/app/connections/messages` renders Not found.
- `npx tsc --noEmit`, focused ESLint and `npm run build` pass.

## Open release gates

- Hosted state is unverified from the development environments: confirm the 53 recorded migrations on `wizqtlgnuiicvpycvhhc` before applying (the apply file checks for `20261019200000`).
- Legal/privacy approval of the Messages copy and 90-day report retention, and an installed purge schedule, before live enablement.
- At least one named reviewer provisioned and the report flow exercised in the Admin Control Center.
- Not covered by automated tests: real iOS Safari keyboard behaviour in the composer, flaky mobile networks, Realtime on the hosted project, and load.
