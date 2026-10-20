import { metaCallback } from "@/lib/privacy/meta-callback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta's Deauthorize callback: the member removed Setuvara in Instagram. Verified by signed_request;
 * deletes that member's connected Instagram account, its tokens and synced details. Instagram only.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  return metaCallback(request, params, "platform_deauthorize");
}
