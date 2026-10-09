# Setuvara Auth Email Hook

This Supabase Edge Function receives signed Auth Send Email Hook events and sends messages through the Resend API. Signup confirmation links go directly to the Setuvara `/auth/confirm` route and use `token_hash`; they do not use Supabase's hosted `/verify` URL.

## Edge Function secrets

Configure these in the verified Setuvara Supabase project's Edge Function secrets:

- `RESEND_API_KEY`
- `SEND_EMAIL_HOOK_SECRET` (the generated Auth Hook secret, including its `v1,whsec_` prefix)

The function uses the locked sender `Setuvara <noreply@setuvara.com>`. Secret values must never be stored in tracked files.

## Deploy and enable

Deploy `send-email` with JWT verification disabled because the function verifies the signed Standard Webhooks request itself. In Supabase Dashboard, open **Authentication → Hooks → Send Email Hook**, select **HTTPS**, enter the deployed Edge Function URL and the same generated hook secret, then enable the hook. Keep the Email Provider enabled. With the hook enabled, Supabase Auth sends email through this hook instead of SMTP.

Allowed confirmation origins are `https://setuvara.com`, `http://127.0.0.1:3014`, and `http://localhost:3014`.
