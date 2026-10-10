import "server-only";

export type AppleWalletConfig = {
  passTypeId: string;
  teamId: string;
  signerCertificate: Buffer;
  signerPrivateKey: Buffer;
  signerPrivateKeyPassphrase?: string;
  wwdrCertificate: Buffer;
  apnsKeyId: string;
  apnsPrivateKey: Buffer;
  passAuthSecret: Buffer;
};

export type GoogleWalletConfig = {
  issuerId: string;
  classId: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: Buffer;
};

export type WalletServerConfig = {
  apple: AppleWalletConfig | null;
  google: GoogleWalletConfig | null;
};

function env(name: string) {
  return process.env[name]?.trim() || null;
}

function pemFromBase64(name: string) {
  const value = env(name);
  if (!value) return null;
  const decoded = Buffer.from(value, "base64");
  return decoded.length > 0 && decoded.toString("base64").replace(/=+$/, "") === value.replace(/=+$/, "")
    ? decoded
    : null;
}

function passAuthSecret() {
  const value = env("WALLET_PASS_AUTH_SECRET");
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  const decoded = Buffer.from(value, "base64url");
  return decoded.length === 32 && decoded.toString("base64url") === value ? decoded : null;
}

export function getWalletServerConfig(): WalletServerConfig {
  const passTypeId = env("APPLE_WALLET_PASS_TYPE_ID");
  const teamId = env("APPLE_WALLET_TEAM_ID");
  const signerCertificate = pemFromBase64("APPLE_WALLET_SIGNER_CERTIFICATE_BASE64");
  const signerPrivateKey = pemFromBase64("APPLE_WALLET_SIGNER_PRIVATE_KEY_BASE64");
  const wwdrCertificate = pemFromBase64("APPLE_WALLET_WWDR_CERTIFICATE_BASE64");
  const apnsKeyId = env("APPLE_WALLET_APNS_KEY_ID");
  const apnsPrivateKey = pemFromBase64("APPLE_WALLET_APNS_PRIVATE_KEY_BASE64");
  const authSecret = passAuthSecret();
  const apple =
    passTypeId && /^pass\.[A-Za-z0-9.-]{3,120}$/.test(passTypeId) &&
    teamId && /^[A-Z0-9]{10}$/.test(teamId) &&
    signerCertificate?.toString("utf8").includes("BEGIN CERTIFICATE") &&
    signerPrivateKey?.toString("utf8").includes("PRIVATE KEY") &&
    wwdrCertificate?.toString("utf8").includes("BEGIN CERTIFICATE") &&
    apnsKeyId && /^[A-Za-z0-9]{10}$/.test(apnsKeyId) &&
    apnsPrivateKey?.toString("utf8").includes("PRIVATE KEY") &&
    authSecret
      ? {
          passTypeId,
          teamId,
          signerCertificate,
          signerPrivateKey,
          signerPrivateKeyPassphrase: env("APPLE_WALLET_SIGNER_PRIVATE_KEY_PASSPHRASE") ?? undefined,
          wwdrCertificate,
          apnsKeyId,
          apnsPrivateKey,
          passAuthSecret: authSecret,
        }
      : null;

  const issuerId = env("GOOGLE_WALLET_ISSUER_ID");
  const classId = env("GOOGLE_WALLET_CLASS_ID");
  const serviceAccountEmail = env("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL");
  const serviceAccountPrivateKey = pemFromBase64("GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64");
  const google =
    issuerId && /^\d{1,32}$/.test(issuerId) &&
    classId && classId.startsWith(`${issuerId}.`) && /^[A-Za-z0-9._-]{1,255}$/.test(classId) &&
    serviceAccountEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(serviceAccountEmail) &&
    serviceAccountPrivateKey?.toString("utf8").includes("PRIVATE KEY")
      ? { issuerId, classId, serviceAccountEmail, serviceAccountPrivateKey }
      : null;

  return { apple, google };
}

/** This deliberately reports readiness only; secret names and values stay server-side. */
export function getWalletProviderAvailability() {
  const config = getWalletServerConfig();
  return {
    apple: { available: config.apple !== null, status: config.apple ? "ready" as const : "setup_required" as const },
    google: { available: config.google !== null, status: config.google ? "ready" as const : "setup_required" as const },
  };
}
