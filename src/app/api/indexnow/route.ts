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
  const { data: valid } = await createCommerceServiceClient().rpc("indexnow_cron_token_valid", { p_token: token });
  if (valid !== true) return Response.json({ error: "Not found." }, { status: 404 });
  // Only production speaks for setuvara.com.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return Response.json({ skipped: "not production" });

  const urls = changedUrls(await sitemap(), process.env.SETUVARA_BUILT_AT);
  if (!urls.length) return Response.json({ submitted: 0 });
  try {
    const status = await submitToIndexNow(urls);
    return Response.json({ submitted: urls.length, status }, { status: status === 200 || status === 202 ? 200 : 502 });
  } catch {
    return Response.json({ submitted: 0, error: "IndexNow did not answer." }, { status: 502 });
  }
}
