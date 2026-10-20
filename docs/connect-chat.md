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

Use an **isolated** Setuvara local Supabase stack. Do not reset a shared local database or use the hosted project for tests. Apply all 54 migrations. In that isolated database, run:

```sql
update private.chat_runtime set enabled = true, updated_at = now() where singleton;
```

Then run `npx supabase test db` for pgTAP authorization and deletion checks. The local multi-account flow is `npm run e2e:chat`, with `CHAT_TEST_LOCAL=1`, `CHAT_TEST_SUPABASE_URL`, `CHAT_TEST_PUBLISHABLE_KEY`, and `CHAT_TEST_SECRET_KEY` pointing only to that isolated local stack. Start the Next app with `CONNECT_CHAT_ENABLED=true` and the same local Supabase URL/key, then run `npm run e2e:chat:ui` with `CHAT_TEST_APP_URL` set to its local URL. Both scripts reject nonlocal URLs. The browser script checks request, acceptance, realtime delivery, reporting, preferences, blocking, and horizontal overflow at mobile and desktop sizes. Run `npx next typegen`, `npx tsc --noEmit --incremental false`, focused lint, and a production build. Inspect member and reviewer flows visually before release.

## Hosted release sequence — approval required

1. Independently verify the Setuvara project ref, environment, live schema, and all 53 previously applied migrations in the Codex execution environment. Resolve any drift before continuing.
2. Obtain privacy approval for the 90-day post-closure report period, what happens to open cases, legal holds, the Connection deletion notice correction, and the published wording. Establish and test a daily purge schedule calling `public.chat_purge_closed_reports()` as the database owner or service role. No schedule is installed by this branch.
3. Provision named safety reviewers only through a reviewed insert into `private.chat_report_reviewers`, after existing admin enrollment and MFA. Confirm list, case open, status update, audit records, and least-privilege denial. Do not add general admins by default.
4. Apply migration 54 with `private.chat_runtime.enabled` remaining false. Check RLS, grants, indexes, publication, RPCs and migration ledger. Deploy the application with `CONNECT_CHAT_ENABLED` absent. Confirm normal Setuvara flows and that chat requests and direct RPC calls remain closed.
5. After explicit launch approval, enable `private.chat_runtime` in a reviewed SQL transaction, then promptly deploy with `CONNECT_CHAT_ENABLED=true`. The database gate opens first so the visible UI never points at disabled RPCs. Smoke test with consented test accounts: eligibility, request, acceptance, concurrent sends and retries, decline, block, report, hide, unread, offline recovery, account deletion and report retention. Monitor errors, latency and abuse volume without recording message bodies.

## Rollback

Set `private.chat_runtime.enabled=false` first to stop participant reads and writes, then disable `CONNECT_CHAT_ENABLED` in the application. Keep the migration and data in place while investigating; reverting the migration would destroy chat data and is not an operational rollback. The reviewer tools and retention maintenance must continue for existing reports while messaging is disabled. Re-enable only after the incident is resolved and the two gates are deliberately restored.

## Open release gates

- This Codex environment has not verified the hosted migration ledger or live schema (403).
- The isolated local Docker engine returned HTTP 500 during migration startup; migration execution, pgTAP, the multi-account script and browser flows remain unverified until an isolated database is available.
- Legal/privacy approval and an operational purge schedule are required before live enablement.
