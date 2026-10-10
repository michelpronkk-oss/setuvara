# Setuvara Wallet infrastructure

Setuvara Wallet creates one pass per canonical identity. The pass displays the
currently Equipped, enabled Mode and uses the existing Quick Share URL as its
QR target. It does not create another QR token or store the share URL. Public
Quick Share resolution continues to enforce publication and Mode availability.

## Current behavior

- `wallet.core` is available on Free, Plus, and Pro.
- `wallet.premium_appearance` is available on Plus and Pro; the current V1
  appearance choices are Setuvara Classic and Editorial.
- The owner surface is `/app/wallet`.
- Apple pass downloads and Apple update registration are implemented by the
  `/api/wallet/apple` routes.
- Google uses a Generic Pass object and a signed Save-to-Wallet URL.
- Provider credentials are server-only. When configuration is missing or
  malformed, the UI reports setup required and provider actions fail closed.
- `public.wallet_passes` and `public.apple_wallet_registrations` have RLS and
  explicit grants: only `service_role` can access provider records. Do not add
  user-facing policies to these tables.

## Apple Wallet setup

Create an Apple Pass Type ID for Setuvara, issue its signing certificate, and
create an APNs key for Wallet update pushes. Add the following variables to the
server environment for each deployment that should issue passes. Never use a
`NEXT_PUBLIC_` prefix.

| Variable | Value |
| --- | --- |
| `WALLET_PASS_AUTH_SECRET` | A stable random 32-byte base64url value. Keep it unchanged across deployments so installed passes keep working. |
| `APPLE_WALLET_PASS_TYPE_ID` | The registered Pass Type ID, for example `pass.com.setuvara.identity`. |
| `APPLE_WALLET_TEAM_ID` | The Apple Developer Team ID. |
| `APPLE_WALLET_SIGNER_CERTIFICATE_BASE64` | Base64-encoded PEM Pass Type ID certificate. |
| `APPLE_WALLET_SIGNER_PRIVATE_KEY_BASE64` | Base64-encoded PEM private key matching the Pass Type ID certificate. |
| `APPLE_WALLET_SIGNER_PRIVATE_KEY_PASSPHRASE` | The private-key passphrase, if the key is encrypted. |
| `APPLE_WALLET_WWDR_CERTIFICATE_BASE64` | Base64-encoded Apple WWDR intermediate certificate. |
| `APPLE_WALLET_APNS_KEY_ID` | APNs key ID. |
| `APPLE_WALLET_APNS_PRIVATE_KEY_BASE64` | Base64-encoded PEM APNs `.p8` private key. |

Configure the Pass Type ID certificate and APNs key for the same Setuvara team.
Use the Wallet service endpoints over HTTPS in production. A pass includes a
stable HMAC-derived authentication token. The web service validates it in
constant time, hashes device library identifiers before storage, and never
logs APNs push tokens. Profile, Mode, Equipped Mode, and Quick Share locator
changes mark existing pass content stale. The owner can request provider
refresh from Wallet; Google objects are patched and Apple devices are sent an
empty APNs wakeup so Wallet can fetch the latest signed pass.

## Google Wallet setup

Create a Google Wallet issuer, create a Generic Class for Setuvara under that
issuer, and complete Google's issuer approval process. The class must exist
before the Setuvara Save-to-Wallet action is enabled. Grant a dedicated service
account the Wallet Objects issuer scope and add it as an authorized user of the
issuer. Set these server-only variables:

| Variable | Value |
| --- | --- |
| `GOOGLE_WALLET_ISSUER_ID` | Numeric issuer ID. |
| `GOOGLE_WALLET_CLASS_ID` | Existing approved class ID prefixed with the issuer ID. |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL` | Service account email authorized on that issuer. |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64` | Base64-encoded PEM service-account private key. |

The object ID is stable per Setuvara profile. An unpublished identity or
disabled Equipped Mode is represented as inactive, and the QR always resolves
through the existing Quick Share route so current publication checks still
apply. Google Wallet Generic Pass does not support a per-user photo in this
object design; the V1 pass uses restrained Setuvara styling and the identity
name.

## Local verification

The Wallet unit tests need no provider credentials or external calls:

```bash
npm run test:wallet
npm run test:billing
```

After changing the Wallet migration, reset and lint the local Supabase stack,
then run the database tests:

```bash
supabase db reset --local
supabase db lint --local
supabase test db
```

The migration gives the application server a private registry for stable
provider identifiers and Apple update registrations. It does not create
profile, Mode, link, or billing data and does not enable client API access to
Wallet records.

## Production activation status

Provider readiness is based on complete, valid server-side environment
configuration; it is not a live provider credential or class approval probe.
Before production activation, provision the Apple and Google credentials above
in the Setuvara Vercel project's Production environment, redeploy, then perform
a free pass issue/update smoke test. Do not complete a purchase or add provider
secrets to this repository.
