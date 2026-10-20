import type { Metadata } from "next";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { fileSize } from "@/components/commerce/ui";
import { createCommerceServiceClient, hashToken, isDownloadToken } from "@/lib/commerce/server";

export const metadata: Metadata = { title: "Your download · Setuvara", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

type Link = { state: "ok" | "revoked" | "expired" | "used_up" | "not_found"; offer_title?: string; delivery_note?: string; creator_user_id?: string; expires_at?: string | null; remaining?: number; files?: { id: string; file_name: string; size_bytes: number }[] };
const STATE: Record<Exclude<Link["state"], "ok">, [string, string]> = {
  revoked: ["This link no longer works.", "The order was refunded or cancelled."],
  expired: ["This link has expired.", "Ask the seller for a new one; they can send it from their Setuvara studio."],
  used_up: ["This link has been used up.", "Ask the seller for a new link; they can send it from their Setuvara studio."],
  not_found: ["We can't find this link.", "Check that you copied the whole link from the email."],
};
const ERROR: Record<string, string> = { unavailable: "That file isn't available on this link any more.", storage: "The file didn't open. Try again.", busy: "Too many downloads at once. Wait a minute and try again." };

/**
 * A buyer's files. Opening the page costs nothing; each Download button posts,
 * spends one download and redirects to a short-lived signed URL.
 */
export default async function DownloadPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string }> }) {
  const [{ token }, { e }] = await Promise.all([params, searchParams]);
  const service = isDownloadToken(token) ? createCommerceServiceClient() : null;
  const { data } = service ? await service.rpc("commerce_open_download", { p_token_hash: hashToken(token) }) : { data: null };
  const link = (data as Link | null) ?? { state: "not_found" as const };
  const { data: creator } = link.creator_user_id && service ? await service.from("profiles").select("display_name").eq("id", link.creator_user_id).maybeSingle() : { data: null };

  return (
    <main className={`${marketingFontClasses} grid min-h-dvh place-items-center bg-[#F5F4EF] px-5 py-10 font-brand text-[#0D0D0D]`}>
      <div className="w-full max-w-[520px]" data-download-state={link.state}>
        <p className="font-label text-[11px] uppercase tracking-[0.16em] text-black/55">Your download{creator?.display_name ? ` · ${creator.display_name}` : ""}</p>
        {link.state !== "ok" ? (
          <><h1 className="mt-3 font-display text-[40px] font-bold leading-[0.95] tracking-[-0.06em]">{STATE[link.state][0]}</h1><p className="mt-3 text-[16px] text-black/65">{STATE[link.state][1]}</p></>
        ) : (
          <>
            <h1 className="mt-3 font-display text-[40px] font-bold leading-[0.95] tracking-[-0.06em]">{link.offer_title}</h1>
            <p className="mt-2 text-[14px] text-black/55">{link.remaining} download{link.remaining === 1 ? "" : "s"} left{link.expires_at ? ` · works until ${new Date(link.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}</p>
            {e && ERROR[e] && <p className="mt-4 rounded-2xl bg-[#FFE7B8] px-4 py-3 text-[15px]" role="alert">{ERROR[e]}</p>}
            <ul className="mt-6 divide-y divide-black/10 rounded-[22px] bg-white px-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
              {(link.files ?? []).map((file) => (
                <li className="flex items-center gap-3 py-4" key={file.id}>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold">{file.file_name}</span><span className="block text-[13px] text-black/55">{fileSize(file.size_bytes)}</span></span>
                  <form action="/api/commerce/download" method="post"><input name="token" type="hidden" value={token} /><input name="file" type="hidden" value={file.id} /><button className="inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-[18px] text-[15px] font-semibold text-[#F5F4EF] focus-visible:outline-2 focus-visible:outline-offset-2" type="submit">Download</button></form>
                </li>
              ))}
            </ul>
            {link.delivery_note && <div className="mt-5 rounded-[18px] bg-[#E8E2D4] p-4"><p className="font-label text-[10.5px] uppercase tracking-[0.16em] text-black/55">From {creator?.display_name ?? "the seller"}</p><p className="mt-2 whitespace-pre-line text-[15px] leading-[1.5]">{link.delivery_note}</p></div>}
            <p className="mt-6 text-[12px] leading-[1.5] text-black/50">This link is yours; please don&apos;t share it. Files are delivered through Setuvara for {creator?.display_name ?? "the seller"}.</p>
          </>
        )}
      </div>
    </main>
  );
}
