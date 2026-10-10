import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash, generateKeyPairSync, verify, webcrypto } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { build } from "esbuild";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";
import { unzipSync } from "fflate";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const out = mkdtempSync(join(cache, "setuvara-wallet-"));
let wallet;

before(async () => {
  await build({
    stdin: {
      contents: `
        export * from "@/lib/wallet/model";
        export { signGoogleWalletSaveJwt, googleSaveUrl } from "@/lib/wallet/google";
        export { getWalletProviderAvailability, getWalletServerConfig } from "@/lib/wallet/config";
        export { canAccessApplePass, readApplePushToken } from "@/lib/wallet/apple-web-service";
        export { createApplePassArchive } from "@/lib/wallet/apple";
      `,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    format: "cjs",
    platform: "node",
    alias: { "@": join(root, "src") },
    plugins: [{
      name: "strip-server-only-marker",
      setup(builder) {
        builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "wallet-empty" }));
        builder.onLoad({ filter: /.*/, namespace: "wallet-empty" }, () => ({ contents: "", loader: "js" }));
      },
    }],
    outfile: join(out, "wallet.cjs"),
    logLevel: "silent",
  });
  wallet = createRequire(import.meta.url)(join(out, "wallet.cjs"));
});

after(() => rmSync(out, { recursive: true, force: true }));

const profile = {
  profileId: "11111111-2222-4333-8444-555555555555",
  username: "aanya",
  displayName: "Aanya Rao",
  published: true,
  mode: "event",
  modeEnabled: true,
  modeSettings: { event_name: "Slush", event_city: "Helsinki", date_label: "Nov 2026" },
  appearance: "classic",
};
const quickShareUrl = "https://setuvara.com/q/opaque-existing-locator";

describe("Setuvara Wallet data model", () => {
  test("Google GenericObject uses the current Equipped Mode and the existing Quick Share URL", () => {
    const id = wallet.googleObjectId("1234567890123456789", profile.profileId);
    const object = wallet.buildGoogleGenericObject(profile, id, "1234567890123456789.setuvara", quickShareUrl);
    assert.equal(id, "1234567890123456789.11111111222243338444555555555555");
    assert.equal(object.state, "ACTIVE");
    assert.equal(object.barcode.value, quickShareUrl);
    assert.match(object.subheader.defaultValue.value, /Event Mode/);
    assert.doesNotMatch(JSON.stringify(object), /image|photo|avatar/i);
    assert.equal(wallet.buildGoogleGenericObject({ ...profile, modeEnabled: false }, id, object.classId, quickShareUrl).state, "INACTIVE");
    assert.equal(wallet.buildGoogleGenericObject({ ...profile, published: false }, id, object.classId, quickShareUrl).state, "INACTIVE");
  });

  test("Apple pass keeps stable authorization, uses the same Quick Share target, and voids unavailable identities", () => {
    const key = Buffer.alloc(32, 7);
    const token = wallet.deriveAppleAuthenticationToken(profile.profileId, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", key);
    assert.equal(token, wallet.deriveAppleAuthenticationToken(profile.profileId, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", key));
    assert.equal(wallet.isAppleAuthenticationTokenValid(token, token), true);
    assert.equal(wallet.isAppleAuthenticationTokenValid(token, `${token}x`), false);
    assert.notEqual(token, wallet.deriveAppleAuthenticationToken(profile.profileId, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", Buffer.alloc(32, 8)));

    const pass = wallet.buildApplePassProps(profile, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", token, "https://setuvara.com/api/wallet/apple", quickShareUrl);
    assert.equal(pass.barcodes[0].message, quickShareUrl);
    assert.equal(pass.authenticationToken, token);
    assert.equal(pass.webServiceURL, "https://setuvara.com/api/wallet/apple");
    assert.equal(pass.voided, false);
    assert.equal(wallet.buildApplePassProps({ ...profile, published: false }, "s", token, "https://setuvara.com/api/wallet/apple", quickShareUrl).voided, true);
    assert.doesNotMatch(JSON.stringify(pass), /private.key|service.role|secret/i);
  });

  test("Apple registration identifiers and push tokens are validated and hashed", () => {
    assert.equal(wallet.validDeviceLibraryIdentifier("device-0123456789"), true);
    assert.equal(wallet.validDeviceLibraryIdentifier("<script>"), false);
    const pushToken = "aB".repeat(32);
    assert.equal(wallet.validApplePushToken(pushToken), true);
    assert.equal(wallet.validApplePushToken("abc"), false);
    assert.equal(wallet.hashDeviceLibraryIdentifier("device-0123456789").length, 32);
    assert.notDeepEqual(wallet.hashDeviceLibraryIdentifier("device-0123456789"), Buffer.from("device-0123456789"));
  });

  test("Apple update endpoints require the pass-bound authorization token and a valid APNs token", async () => {
    const serial = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const secret = Buffer.alloc(32, 9);
    const pass = { profile_id: profile.profileId, apple_serial_number: serial };
    const token = wallet.deriveAppleAuthenticationToken(profile.profileId, serial, secret);
    const config = { passTypeId: "pass.com.setuvara.identity", teamId: "TEAM123456", passAuthSecret: secret };
    const authorized = new Request("https://setuvara.com/api/wallet/apple", { headers: { authorization: `ApplePass ${token}` } });
    const unauthorized = new Request("https://setuvara.com/api/wallet/apple", { headers: { authorization: "Bearer invalid" } });
    assert.equal(wallet.canAccessApplePass(authorized, pass, config), true);
    assert.equal(wallet.canAccessApplePass(unauthorized, pass, config), false);
    const pushToken = "ab".repeat(32);
    const body = new Request("https://setuvara.com/api/wallet/apple", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pushToken }),
    });
    assert.equal(await wallet.readApplePushToken(body), pushToken);
    const invalidBody = new Request("https://setuvara.com/api/wallet/apple", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pushToken: "not-a-token" }),
    });
    assert.equal(await wallet.readApplePushToken(invalidBody), null);
  });
});

describe("Google Wallet signing", () => {
  test("Save-to-Wallet JWT is signed and contains the canonical object and origin", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const config = {
      issuerId: "1234567890123456789",
      classId: "1234567890123456789.setuvara",
      serviceAccountEmail: "wallet-service@setuvara.example",
      serviceAccountPrivateKey: Buffer.from(privateKey.export({ type: "pkcs8", format: "pem" })),
    };
    const object = wallet.buildGoogleGenericObject(profile, wallet.googleObjectId(config.issuerId, profile.profileId), config.classId, quickShareUrl);
    const token = wallet.signGoogleWalletSaveJwt(config, object, "https://setuvara.com", 1_800_000_000);
    const [headerPart, claimsPart, signaturePart] = token.split(".");
    const signingInput = `${headerPart}.${claimsPart}`;
    const claims = JSON.parse(Buffer.from(claimsPart, "base64url").toString("utf8"));
    assert.equal(claims.iss, config.serviceAccountEmail);
    assert.deepEqual(claims.origins, ["https://setuvara.com"]);
    assert.deepEqual(claims.payload.genericObjects, [object]);
    assert.equal(verify("RSA-SHA256", Buffer.from(signingInput), publicKey, Buffer.from(signaturePart, "base64url")), true);
    assert.equal(wallet.googleSaveUrl(token), `https://pay.google.com/gp/v/save/${token}`);
  });
});

test("Wallet readiness fails closed without provider configuration and exposes no internals", () => {
  const variables = [
    "WALLET_PASS_AUTH_SECRET",
    "APPLE_WALLET_PASS_TYPE_ID",
    "APPLE_WALLET_TEAM_ID",
    "APPLE_WALLET_SIGNER_CERTIFICATE_BASE64",
    "APPLE_WALLET_SIGNER_PRIVATE_KEY_BASE64",
    "APPLE_WALLET_SIGNER_PRIVATE_KEY_PASSPHRASE",
    "APPLE_WALLET_WWDR_CERTIFICATE_BASE64",
    "APPLE_WALLET_APNS_KEY_ID",
    "APPLE_WALLET_APNS_PRIVATE_KEY_BASE64",
    "GOOGLE_WALLET_ISSUER_ID",
    "GOOGLE_WALLET_CLASS_ID",
    "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64",
  ];
  const previous = new Map(variables.map((name) => [name, process.env[name]]));
  try {
    for (const name of variables) delete process.env[name];
    const availability = wallet.getWalletProviderAvailability();
    assert.deepEqual(availability, {
      apple: { available: false, status: "setup_required" },
      google: { available: false, status: "setup_required" },
    });
    assert.doesNotMatch(JSON.stringify(availability), /private|secret|credential|key/i);
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("Apple pass archive contains a detached CMS signature over its resource manifest", async () => {
  const cryptoEngine = new pkijs.CryptoEngine({ name: "setuvara-wallet-test", crypto: webcrypto });
  pkijs.setEngine("setuvara-wallet-test", cryptoEngine);
  const keys = await webcrypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  }, true, ["sign", "verify"]);
  const name = new pkijs.RelativeDistinguishedNames({
    typesAndValues: [new pkijs.AttributeTypeAndValue({ type: "2.5.4.3", value: new asn1js.Utf8String({ value: "Setuvara Wallet Test" }) })],
  });
  const certificate = new pkijs.Certificate();
  certificate.version = 2;
  certificate.serialNumber = new asn1js.Integer({ value: 1 });
  certificate.issuer = name;
  certificate.subject = name;
  certificate.notBefore = new pkijs.Time({ value: new Date(Date.now() - 60_000) });
  certificate.notAfter = new pkijs.Time({ value: new Date(Date.now() + 86_400_000) });
  await certificate.subjectPublicKeyInfo.importKey(keys.publicKey, cryptoEngine);
  await certificate.sign(keys.privateKey, "SHA-256", cryptoEngine);
  const certificatePem = pem("CERTIFICATE", Buffer.from(certificate.toSchema(true).toBER(false)));
  const privateKeyPem = pem("PRIVATE KEY", Buffer.from(await webcrypto.subtle.exportKey("pkcs8", keys.privateKey)));
  const config = {
    passTypeId: "pass.com.setuvara.identity",
    teamId: "TEAM123456",
    signerCertificate: Buffer.from(certificatePem),
    signerPrivateKey: Buffer.from(privateKeyPem),
    wwdrCertificate: Buffer.from(certificatePem),
    passAuthSecret: Buffer.alloc(32, 4),
  };

  const archive = await wallet.createApplePassArchive(
    profile,
    config,
    "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    "stable-test-token",
    "https://setuvara.com/api/wallet/apple",
    quickShareUrl,
  );
  const entries = unzipSync(new Uint8Array(archive));
  const manifestBytes = Buffer.from(entries["manifest.json"]);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  for (const [file, expectedHash] of Object.entries(manifest)) {
    assert.equal(createHash("sha1").update(entries[file]).digest("hex"), expectedHash);
  }
  const pass = JSON.parse(Buffer.from(entries["pass.json"]).toString("utf8"));
  assert.equal(pass.passTypeIdentifier, config.passTypeId);
  assert.equal(pass.teamIdentifier, config.teamId);
  assert.equal(pass.barcodes[0].message, quickShareUrl);
  const cmsAsn1 = asn1js.fromBER(entries.signature);
  assert.notEqual(cmsAsn1.offset, -1);
  const contentInfo = new pkijs.ContentInfo({ schema: cmsAsn1.result });
  assert.equal(contentInfo.contentType, pkijs.ContentInfo.SIGNED_DATA);
  const signedData = new pkijs.SignedData({ schema: contentInfo.content });
  assert.equal(signedData.encapContentInfo.eContent, undefined, "PKPass signature must be detached");
  const manifestView = new Uint8Array(entries["manifest.json"]);
  const detachedData = manifestView.buffer.slice(manifestView.byteOffset, manifestView.byteOffset + manifestView.byteLength);
  assert.equal(await signedData.verify({ signer: 0, data: detachedData, checkChain: false }, cryptoEngine), true);
});

function pem(label, bytes) {
  const base64 = bytes.toString("base64").match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----\n`;
}
