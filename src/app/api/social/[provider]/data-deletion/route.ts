import { metaCallback } from "@/lib/privacy/meta-callback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta's Data Deletion Request callback. Verified by signed_request; deletes the Instagram-derived
 * data and answers { url, confirmation_code } with a public status page. Instagram only.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  return metaCallback(request, params, "platform_data_deletion");
}
