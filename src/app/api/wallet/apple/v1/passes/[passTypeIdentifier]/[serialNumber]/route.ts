import { getSetuvaraOrigin } from "@/lib/billing/config";
import { createApplePassArchive } from "@/lib/wallet/apple";
import { appleServiceError, canAccessApplePass } from "@/lib/wallet/apple-web-service";
import { getWalletServerConfig } from "@/lib/wallet/config";
import { deriveAppleAuthenticationToken } from "@/lib/wallet/model";
import {
  createWalletAdminClient,
  getStoredQuickShareUrl,
  getWalletPassBySerial,
  loadAdminWalletProfileData,
} from "@/lib/wallet/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ passTypeIdentifier: string; serialNumber: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { passTypeIdentifier, serialNumber } = await context.params;
    const config = getWalletServerConfig().apple;
    if (!config) return appleServiceError(503);
    if (passTypeIdentifier !== config.passTypeId || !/^[0-9a-f-]{36}$/i.test(serialNumber)) {
      return appleServiceError(404);
    }

    const record = await getWalletPassBySerial(serialNumber);
    if (!record) return appleServiceError(404);
    if (!canAccessApplePass(request, record, config)) return appleServiceError(401);

    const [profile, shareUrl] = await Promise.all([
      loadAdminWalletProfileData(record.profile_id),
      getStoredQuickShareUrl(createWalletAdminClient(), record.profile_id),
    ]);
    const token = deriveAppleAuthenticationToken(record.profile_id, record.apple_serial_number, config.passAuthSecret);
    const archive = await createApplePassArchive(
      profile,
      config,
      record.apple_serial_number,
      token,
      `${getSetuvaraOrigin()}/api/wallet/apple`,
      shareUrl,
    );

    return new Response(new Uint8Array(archive), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": 'inline; filename="Setuvara.pkpass"',
        "Cache-Control": "private, no-store",
        "Last-Modified": new Date(record.content_updated_at).toUTCString(),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return appleServiceError(503);
  }
}
