# Setuvara Tap

Tap is an opaque entry point into one identity's current Equipped Share State. A Tap token is a public pointer, not an account credential. The database stores only its SHA-256 digest; the application returns the raw `/t/<token>` URL once when a device is created or rotated.

## Product controls

The owner manages Tap at `/app/tap`. Equipped selects one enabled Personal, Event, or Business Mode and either **View profile** or **Connect in person**. Saving changes the existing identity-wide database state; it does not change Connection Access policy. A Mode with `nobody` policy remains view-only. An unpublished profile or disabled Mode cannot resolve from Tap or Quick QR.

The Home stage and its Share sheet link to Tap without replacing the existing Mode-specific QR. Mode-specific sharing stays fixed to the chosen Mode. Quick QR follows Equipped, so changing Equipped changes what the same Quick QR and every active Tap device open.

## Quick Share

`/q/<opaque-token>` is a stable identity-scoped Quick Share locator, independent of physical Tap devices. It resolves the current Equipped state on every request and redirects to the canonical profile with `source=quick_qr`. A lost or disabled physical device has no effect on Quick QR. Its public URL can later be encoded by a Wallet QR without a new resolver; Wallet is not implemented here.

The `quick_share_locators` table keeps a random nonce and SHA-256 token hash, never the raw token. The application derives the repeatable 43-character token using the server-only `QUICK_SHARE_TOKEN_KEY`. Generate a random 32-byte base64url value and keep it stable for the Setuvara deployment. A missing or changed key makes owner URL rendering fail closed; an owner can rotate a locator after restoring a valid key, without redisplaying the old URL. No hash is exposed to the browser. `POST /api/tap/quick-share` creates or reads the owner's locator and returns its public URL. `POST /api/tap/quick-share/rotate` invalidates the previous URL and its Connection Passes; existing printed QR codes must then be replaced.

The Quick Share table has RLS enabled and no direct Data API grants. Its public resolver can return only a published identity's enabled Equipped Mode. Direct-only Connect uses a short-lived pass scoped to that locator; scans within one time window reuse that pass so public scans cannot exhaust a daily grant quota. The Connection RPC rechecks the live Equipped state and Mode policy and derives verified Quick QR attribution from the bound pass, not a URL query parameter. The locator does not grant account, editing, billing, or device permissions. Quick Share responses and redirects are non-cacheable.

## Resolution

`GET /t/<token>` calls the `resolve_tap` RPC and redirects with `303` to the canonical root profile URL with the selected `mode` and `source=tap`. The redirect is private and non-cacheable. Resolution requires an active device, a published profile, an existing Equipped Share State, and an enabled selected Mode. There is no fallback Mode. Invalid, disabled, lost, retired, unpublished, or otherwise unavailable Taps resolve to a neutral unavailable page.

The Equipped Share State is identity-wide, not per-device. Every Tap follows its current Mode (`personal`, `event`, or `business`) and intent (`view_profile` or `connect_in_person`). Owner APIs read or change this state and manage devices through narrow authenticated RPCs. The management tables have RLS enabled and no direct Data API grants.

The Supabase Security Advisor reports the Tap tables as RLS-enabled without direct policies. This is intentional: all direct privileges are revoked and access goes through the narrowly granted RPCs. The advisor also flags the SECURITY DEFINER RPCs; `resolve_tap` is intentionally callable by anonymous and authenticated visitors, while device management/claim RPCs require an authenticated user and validate ownership or the one-time claim secret. Private helper functions remain uncallable by API roles.

## Connection authorization

`source=tap` records how the visitor arrived; it does not authorize a Connection. A Mode with `anyone` policy continues to allow public Connect without a pass. For `direct_only`, a Tap configured for `connect_in_person` can issue or reuse an existing 15-minute Connection Pass scoped to that device, identity, and Mode. The pass is stored in an HttpOnly, SameSite cookie. The Connection RPC rechecks the live device status, publication state, Equipped Mode/intent, Mode enabled state, and Direct-only policy. View-only Taps do not issue passes. Tap pass rows are revoked when the device token/status, Equipped State, publication, or Mode availability changes.

## Device API

- `GET /api/tap/devices` lists the signed-in owner's devices.
- `POST /api/tap/devices` registers an owner-managed device and returns its URL once.
- `PATCH /api/tap/devices/<id>` updates its label or kind.
- `PATCH /api/tap/devices/<id>/status` disables, marks lost, or retires a device; a disabled device can be re-enabled.
- `POST /api/tap/devices/<id>/rotate` replaces the token and returns the new URL once. Rotation can recover a lost device; retired devices cannot be restored.
- `GET` and `PUT /api/tap/equipped` read and update the identity-wide Equipped Share State.
- `POST /api/tap/claim` consumes a one-time claim secret for a factory-provisioned device. The database stores only its hash; the private provisioning RPC is explicitly granted to `service_role` and is not exposed to browser callers.

No hardware fulfillment or factory-provisioning workflow is included. Owner-created records represent Tap entries controlled by that account; stock claims are a separate path for future provisioning.

To program an owner-created Tap, copy the URL shown immediately after creation or rotation. In an NFC writing app, create a URL/URI record, paste that URL, write it to a standard NDEF-compatible tag, then test it with another phone. The raw URL cannot be recovered later; rotation produces a new one and requires rewriting the tag. A factory Tap instead needs its separate one-time activation code in the claim flow. Its public `/t/` URL is never the claim secret.

## Privacy

Tap activity is best-effort and bounded under repeated hits. Events retain only the device/owner, timestamp, selected Mode, intent, and a closed outcome value. They do not store the raw Tap URL or token, claim secret, visitor identity, email, IP address, user agent, GPS, or location. Event tables are not directly readable by `anon` or `authenticated` roles and have no public analytics endpoint.
