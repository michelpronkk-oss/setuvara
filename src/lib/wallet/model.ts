import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export type WalletMode = "personal" | "event" | "business";
export type WalletAppearance = "classic" | "editorial";

export type WalletProfileData = {
  profileId: string;
  username: string;
  displayName: string;
  published: boolean;
  mode: WalletMode;
  modeEnabled: boolean;
  modeSettings: Record<string, unknown>;
  appearance: WalletAppearance;
};

const labels: Record<WalletMode, string> = {
  personal: "Personal",
  event: "Event",
  business: "Business",
};

function text(value: unknown, max = 80): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

export function walletModeDetail(profile: WalletProfileData) {
  const settings = profile.modeSettings;
  if (profile.mode === "personal") {
    return text(settings.location, 60) ?? "Your Setuvara identity";
  }
  if (profile.mode === "event") {
    return [text(settings.event_name, 60), text(settings.event_city, 40)].filter(Boolean).join(" · ") || "Event Mode";
  }
  return [text(settings.role, 60), text(settings.company, 60), text(settings.city, 40)].filter(Boolean).join(" · ") || "Business Mode";
}

export function buildGoogleGenericObject(input: WalletProfileData, objectId: string, classId: string, shareUrl: string) {
  const title = text(input.displayName, 80) ?? text(input.username, 24) ?? "Setuvara";
  const mode = `${labels[input.mode]} Mode`;
  return {
    id: objectId,
    classId,
    state: input.published && input.modeEnabled ? "ACTIVE" : "INACTIVE",
    cardTitle: { defaultValue: { language: "en-US", value: "Setuvara" } },
    header: { defaultValue: { language: "en-US", value: title } },
    subheader: { defaultValue: { language: "en-US", value: mode } },
    hexBackgroundColor: input.appearance === "editorial" ? "#F5F4EF" : "#0D0D0D",
    barcode: {
      type: "QR_CODE",
      value: shareUrl,
      alternateText: `Open ${title}'s Setuvara profile`,
    },
    textModulesData: [
      { id: "identity", header: "SETUVARA IDENTITY", body: `@${input.username}` },
      { id: "mode", header: mode.toUpperCase(), body: walletModeDetail(input) },
    ],
  } as const;
}

export function buildApplePassProps(
  input: WalletProfileData,
  serialNumber: string,
  authenticationToken: string,
  webServiceURL: string,
  shareUrl: string,
) {
  const title = text(input.displayName, 80) ?? text(input.username, 24) ?? "Setuvara";
  const detail = walletModeDetail(input);
  const isActive = input.published && input.modeEnabled;
  return {
    formatVersion: 1 as const,
    description: "Your Setuvara identity",
    organizationName: "Setuvara",
    logoText: "setuvara",
    serialNumber,
    authenticationToken,
    webServiceURL,
    voided: !isActive,
    backgroundColor: input.appearance === "editorial" ? "rgb(245, 244, 239)" : "rgb(13, 13, 13)",
    foregroundColor: input.appearance === "editorial" ? "rgb(13, 13, 13)" : "rgb(245, 244, 239)",
    labelColor: "rgb(255, 90, 79)",
    barcodes: [{
      format: "PKBarcodeFormatQR" as const,
      message: shareUrl,
      messageEncoding: "iso-8859-1",
      altText: "Scan to open this Setuvara identity",
    }],
    generic: {
      primaryFields: [{ key: "name", label: "SETUVARA", value: title }],
      secondaryFields: [{ key: "mode", label: "MODE", value: `${labels[input.mode]} Mode` }],
      auxiliaryFields: [{ key: "detail", label: labels[input.mode].toUpperCase(), value: detail }],
      backFields: [
        { key: "profile", label: "PROFILE", value: `setuvara.com/${input.username}` },
        { key: "share", label: "SHARE QR", value: "Scan the QR on the front to open the currently Equipped Mode." },
      ],
    },
  };
}

export function googleObjectId(issuerId: string, profileId: string) {
  return `${issuerId}.${profileId.replace(/-/g, "").toLowerCase()}`;
}

export function deriveAppleAuthenticationToken(profileId: string, serialNumber: string, secret: Buffer) {
  return createHmac("sha256", secret)
    .update("setuvara-apple-pass-auth-v1\0", "utf8")
    .update(profileId.toLowerCase(), "utf8")
    .update("\0", "utf8")
    .update(serialNumber.toLowerCase(), "utf8")
    .digest("base64url");
}

export function isAppleAuthenticationTokenValid(expected: string, candidate: string) {
  const expectedBytes = Buffer.from(expected, "utf8");
  const candidateBytes = Buffer.from(candidate, "utf8");
  return expectedBytes.length === candidateBytes.length && timingSafeEqual(expectedBytes, candidateBytes);
}

export function hashDeviceLibraryIdentifier(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function validDeviceLibraryIdentifier(value: string) {
  return /^[A-Za-z0-9._-]{1,256}$/.test(value);
}

export function validApplePushToken(value: string) {
  return /^(?:[A-Fa-f0-9]{2}){32}$/.test(value);
}
