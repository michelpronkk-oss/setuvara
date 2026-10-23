import sitemap from "@/app/sitemap";
import { createCommerceServiceClient } from "@/lib/commerce/server";
import { changedUrls, submitToIndexNow } from "@/lib/seo/indexnow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily IndexNow ping, called by Supabase Cron with a bearer secret kept in Vault. Sends the
 * sitemap URLs that changed in the last day, so search engines recrawl them without waiting.
 */
export async function GET(request: Request) {
  const token = /^Bearer ([A-Za-z0-9]{32,128})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return Response.json({ error: "Not found." }, { status: 404 });
  const service = createCommerceServiceClient();
  const { data: valid } = await service.rpc("indexnow_cron_token_valid", { p_token: token });
  if (valid !== true) return Response.json({ error: "Not found." }, { status: 404 });
  // Only production speaks for setuvara.com.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return Response.json({ skipped: "not production" });

  const urls = changedUrls(await sitemap(), process.env.SETUVARA_BUILT_AT);
  // Every run is logged for the admin's Search & AI view, including empty ones.
  const log = (submitted: number, status: number) => service.rpc("record_indexnow_run", { p_submitted: submitted, p_status: status }).then(() => undefined, () => undefined);
  if (!urls.length) { await log(0, 204); return Response.json({ submitted: 0 }); }
  try {
    const status = await submitToIndexNow(urls);
    await log(urls.length, status);
    return Response.json({ submitted: urls.length, status }, { status: status === 200 || status === 202 ? 200 : 502 });
  } catch {
    await log(0, 0);
    return Response.json({ submitted: 0, error: "IndexNow did not answer." }, { status: 502 });
  }
}
