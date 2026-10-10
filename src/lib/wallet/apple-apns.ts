import "server-only";

import { createSign } from "node:crypto";
import { connect, constants } from "node:http2";

import type { AppleWalletConfig } from "./config";
import { createWalletAdminClient, WalletRequestError } from "./server";

const apnsHost = "https://api.push.apple.com";
let cachedToken: { value: string; createdAt: number } | null = null;

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function getApnsToken(config: AppleWalletConfig) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now - cachedToken.createdAt < 45 * 60) return cachedToken.value;
  const input = `${encode({ alg: "ES256", kid: config.apnsKeyId })}.${encode({ iss: config.teamId, iat: now })}`;
  const signer = createSign("SHA256");
  signer.update(input);
  signer.end();
  const signature = signer.sign({ key: config.apnsPrivateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  cachedToken = { value: `${input}.${signature}`, createdAt: now };
  return cachedToken.value;
}

function sendPush(session: ReturnType<typeof connect>, token: string, passTypeId: string, apnsToken: string) {
  return new Promise<number>((resolve, reject) => {
    const request = session.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${apnsToken}`,
      "apns-topic": passTypeId,
      "apns-push-type": "background",
      "apns-priority": "5",
      "apns-expiration": "0",
      "content-type": "application/json",
    });
    let status = 500;
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      request.close(constants.NGHTTP2_CANCEL);
      reject(new Error("apns_timeout"));
    }, 10_000);
    request.on("response", (headers) => { status = Number(headers[":status"] ?? 500); });
    request.on("end", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(status);
    });
    request.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error("apns_request_failed"));
    });
    request.end("{}");
  });
}

/** Sends empty APNs wakeups only; push tokens and responses are never logged. */
export async function notifyAppleWalletDevices(profileId: string, serialNumber: string, config: AppleWalletConfig) {
  const admin = createWalletAdminClient();
  const { data: registrations, error } = await admin
    .from("apple_wallet_registrations")
    .select("device_library_hash,push_token")
    .eq("profile_id", profileId)
    .eq("pass_serial_number", serialNumber);
  if (error) throw new WalletRequestError("wallet_update_unavailable");
  if (!registrations?.length) return { notified: 0, failed: 0 };

  const session = connect(apnsHost);
  session.on("error", () => {});
  try {
    const token = getApnsToken(config);
    let notified = 0;
    let failed = 0;
    for (const registration of registrations) {
      try {
        const status = await sendPush(session, registration.push_token, config.passTypeId, token);
        if (status >= 200 && status < 300) notified += 1;
        else {
          failed += 1;
          if (status === 410) {
            await admin.from("apple_wallet_registrations")
              .delete()
              .eq("device_library_hash", registration.device_library_hash)
              .eq("pass_serial_number", serialNumber);
          }
        }
      } catch {
        failed += 1;
      }
    }
    return { notified, failed };
  } finally {
    session.close();
  }
}
