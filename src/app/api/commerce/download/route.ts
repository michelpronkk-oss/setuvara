import { NextResponse } from "next/server";

import { createCommerceServiceClient, hashToken, isDownloadToken } from "@/lib/commerce/server";
import { clientIp, createRateLimit } from "@/lib/marketing/inquiry-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = createRateLimit({ windowMs: 10 * 60 * 1000, perIp: 60, perWindow: 5000 });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One file from a download link. A form POST (never a GET a mail scanner could
 * follow) spends one download and redirects to a 60-second signed URL.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const fileId = String(form?.get("file") ?? "");
  const back = new URL(`/d/${isDownloadToken(token) ? token : ""}`, request.url);
  if (!isDownloadToken(token) || !uuid.test(fileId)) return NextResponse.redirect(back, 303);
  const ip = clientIp(request);
  if (!limit.allowed(ip)) { back.searchParams.set("e", "busy"); return NextResponse.redirect(back, 303); }
  limit.record(ip);

  const service = createCommerceServiceClient();
  const { data, error } = await service.rpc("commerce_use_download", { p_token_hash: hashToken(token), p_file_id: fileId });
  if (error) { back.searchParams.set("e", "unavailable"); return NextResponse.redirect(back, 303); }
  const file = data as { storage_path: string; file_name: string };
  const { data: signed } = await service.storage.from("creator-commerce").createSignedUrl(file.storage_path, 60, { download: file.file_name });
  if (!signed?.signedUrl) { back.searchParams.set("e", "storage"); return NextResponse.redirect(back, 303); }
  return NextResponse.redirect(signed.signedUrl, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
