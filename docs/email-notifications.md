# Setuvara email and notification delivery

## Delivery architecture

- Supabase Auth remains responsible for auth users, tokens, and confirmation events. The `send-email` Edge Function verifies Supabase's Standard Webhooks signature and sends the message directly through the Resend API.
- Product messages are written to the private Postgres outbox by database triggers. The dispatcher resolves the confirmed recipient address, current profile details, and current preferences at send time. Guest email addresses are never notification recipients.
- Each source event has a unique key. The dispatcher claims rows with a lease and `FOR UPDATE SKIP LOCKED`, retries provider failures with bounded backoff, and uses a stable Resend idempotency key.
- Optional messages have a single-use, category-scoped unsubscribe link. Security messages do not have unsubscribe links. Product updates default off and no product-update event is currently dispatched.
- There are no open or click tracking pixels. Resend tracking is disabled in API requests.

## Hosted Setuvara setup

1. Verify the Supabase target is the Setuvara project (`wizqtlgnuiicvpycvhhc`, region `eu-west-1`).
2. Deploy `send-email` and `dispatch-notifications` with JWT verification disabled. The auth function verifies Supabase's signed hook; the dispatcher verifies a separate random bearer held in Supabase Vault and checks only its SHA-256 digest in the database.
3. Ensure the Setuvara Edge Function secrets include `RESEND_API_KEY` and `SEND_EMAIL_HOOK_SECRET`. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the Edge runtime; the service-role key is used only by the server-side dispatcher.
4. Enable the Auth Send Email Hook at **Authentication → Hooks → Send Email Hook → HTTPS**, using the deployed `send-email` function URL and the existing generated hook secret. Keep email signups enabled.
5. Run `supabase/operations/enable_notification_dispatch_cron.sql` only against the verified hosted Setuvara database after deploying the dispatcher. This is intentionally separate from migrations so local resets cannot call the hosted project.

The scheduler SQL generates the dispatch bearer in Postgres, stores it in Vault, and stores only its digest in the private schema. It schedules the Setuvara dispatcher once per minute. The endpoint only accepts requests with the Vault-held bearer and the function has no browser-facing caller.

## Local verification

Run `npm run e2e:local` from the Setuvara Git root. The script verifies the local Supabase host before building, uses the local Supabase email capture service, creates random `example.test` accounts, and removes its test users and storage objects afterward. The email template test command is:

```powershell
deno test --allow-env=NODE_ENV --config supabase/functions/send-email/deno.json supabase/functions/_shared/email.test.tsx
```

To render deterministic auth, lifecycle, connection, reward, and future Creator/Business preview templates without dispatching mail:

```powershell
deno run --allow-env --allow-write=.next/email-previews --config supabase/functions/send-email/deno.json supabase/functions/_shared/preview.tsx
```

Preview-only URLs and names are fixtures. They are not written to application tables or used by the dispatcher.

## Preferences and event rules

Owners manage optional email preferences at `/app/settings/notifications`. Security messages stay enabled. Confirmed signups enqueue one welcome email. Registered connection encounters enqueue up to three individual messages per recipient in a rolling hour; further encounters join a single recap scheduled one hour after the first event in that recap. Guest email entry alone produces no email. A guest-claim event can notify only the already-registered Setuvara member whose connection was claimed. Passport milestone and non-milestone stamp events are separately deduplicated.

The only currently dispatched product templates are lifecycle, connection, and Passport notifications. Creator and Business templates are preview fixtures only.
