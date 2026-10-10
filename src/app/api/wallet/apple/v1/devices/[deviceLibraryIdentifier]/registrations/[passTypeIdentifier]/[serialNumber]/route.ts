import {
  appleServiceError,
  canAccessApplePass,
  readApplePushToken,
} from "@/lib/wallet/apple-web-service";
import { getWalletServerConfig } from "@/lib/wallet/config";
import {
  getWalletPassBySerial,
  registerAppleDevice,
  unregisterAppleDevice,
} from "@/lib/wallet/server";
import {
  hashDeviceLibraryIdentifier,
  validDeviceLibraryIdentifier,
} from "@/lib/wallet/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    deviceLibraryIdentifier: string;
    passTypeIdentifier: string;
    serialNumber: string;
  }>;
};

async function resolveRequest(request: Request, context: RouteContext) {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = await context.params;
  const config = getWalletServerConfig().apple;
  if (!config) return { response: appleServiceError(503) } as const;
  if (
    passTypeIdentifier !== config.passTypeId ||
    !validDeviceLibraryIdentifier(deviceLibraryIdentifier) ||
    !/^[0-9a-f-]{36}$/i.test(serialNumber)
  ) return { response: appleServiceError(404) } as const;

  const pass = await getWalletPassBySerial(serialNumber);
  if (!pass) return { response: appleServiceError(404) } as const;
  if (!canAccessApplePass(request, pass, config)) return { response: appleServiceError(401) } as const;

  return {
    config,
    pass,
    deviceHash: hashDeviceLibraryIdentifier(deviceLibraryIdentifier),
  } as const;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const resolved = await resolveRequest(request, context);
    if ("response" in resolved) return resolved.response;
    const pushToken = await readApplePushToken(request);
    if (!pushToken) return appleServiceError(400);
    const status = await registerAppleDevice(
      resolved.pass.profile_id,
      resolved.pass.apple_serial_number,
      resolved.deviceHash,
      pushToken,
    );
    return Response.json({}, { status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return appleServiceError(503);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const resolved = await resolveRequest(request, context);
    if ("response" in resolved) return resolved.response;
    await unregisterAppleDevice(resolved.pass.apple_serial_number, resolved.deviceHash);
    return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return appleServiceError(503);
  }
}
