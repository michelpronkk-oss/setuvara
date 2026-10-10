import { getWalletServerConfig } from "@/lib/wallet/config";
import {
  getAppleDeviceSerials,
  listAppleDevicePasses,
} from "@/lib/wallet/server";
import {
  hashDeviceLibraryIdentifier,
  validDeviceLibraryIdentifier,
} from "@/lib/wallet/model";
import { appleServiceError } from "@/lib/wallet/apple-web-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier } = await context.params;
    const config = getWalletServerConfig().apple;
    if (!config) return appleServiceError(503);
    if (passTypeIdentifier !== config.passTypeId || !validDeviceLibraryIdentifier(deviceLibraryIdentifier)) {
      return appleServiceError(404);
    }

    const url = new URL(request.url);
    const sinceValue = url.searchParams.get("passesUpdatedSince");
    let since: number | null = null;
    if (sinceValue !== null) {
      since = Number(sinceValue);
      if (!Number.isSafeInteger(since) || since < 0) return appleServiceError(400);
    }

    const deviceHash = hashDeviceLibraryIdentifier(deviceLibraryIdentifier);
    const serialNumbers = await getAppleDeviceSerials(deviceHash);
    const passes = await listAppleDevicePasses(serialNumbers);
    const updated = passes.filter((pass) => {
      const timestamp = Date.parse(pass.content_updated_at);
      return Number.isFinite(timestamp) && (since === null || timestamp > since);
    });
    const lastUpdated = passes.reduce((latest, pass) => {
      const timestamp = Date.parse(pass.content_updated_at);
      return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
    }, 0);

    return Response.json({
      serialNumbers: updated.map((pass) => pass.apple_serial_number),
      lastUpdated: String(lastUpdated),
    }, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return appleServiceError(503);
  }
}
