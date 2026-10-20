import type { Metadata } from "next";
import Link from "next/link";

import { Display, Label, Shell } from "@/components/marketing/home/primitives";
import { formatConfirmationCode, KIND_LABEL, normalizeConfirmationCode, STATUS_LABEL, statusExplanation } from "@/lib/privacy/model";
import { requestStatusByCode } from "@/lib/privacy/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Deletion status | Setuvara" }, robots: { index: false, follow: false } };

const when = (value: string) => new Date(value).toLocaleString("en", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });

/**
 * The human-readable status Meta's data deletion contract asks for. The code is random and only
 * reveals the request's type, status and dates: no name, handle or platform id.
 */
export default async function DeletionStatusRoute({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const raw = (await searchParams).code;
  const code = normalizeConfirmationCode(Array.isArray(raw) ? raw[0] : raw);
  const found = code ? await requestStatusByCode(code).catch(() => null) : null;
  const tone = found?.status === "completed" || found?.status === "no_data" ? "bg-[#2fa66a]" : found?.status === "failed" ? "bg-coral" : "bg-ink/40";

  return (
    <section aria-labelledby="status-title" className="relative isolate overflow-hidden">
      <span aria-hidden="true" className="absolute -right-32 -top-40 -z-10 size-[520px] rounded-full bg-coral/15 blur-[120px]" />
      <Shell className="flex flex-col gap-8 pb-20 pt-10 sm:pt-16">
        <div className="flex flex-col gap-5">
          <Label className="text-coral">Data deletion</Label>
          <Display as="h1" className="text-[clamp(40px,6vw,80px)] leading-[0.92]"><span id="status-title">Request status</span></Display>
        </div>

        {found && code ? (
          <div className="w-full max-w-[40rem] rounded-[1.75rem] bg-white p-6 shadow-[0_0_0_1px_rgba(13,13,13,.08)] sm:p-8" role="status">
            <p className="font-label text-[11px] uppercase tracking-[0.16em] text-ink/55">{KIND_LABEL[found.kind]}</p>
            <p className="mt-3 flex items-center gap-3 font-display text-[30px] font-bold tracking-[-0.04em]"><span aria-hidden="true" className={`size-2.5 rounded-full ${tone}`} />{STATUS_LABEL[found.status]}</p>
            <p className="mt-3 text-[16px] leading-[1.6] text-ink/75">{statusExplanation(found.kind, found.status)}</p>
            <dl className="mt-6 grid gap-3 border-t border-ink/10 pt-5 text-[14px] sm:grid-cols-[auto_1fr] sm:gap-x-8">
              <dt className="text-ink/55">Code</dt><dd className="font-label tracking-[0.08em]">{formatConfirmationCode(code)}</dd>
              <dt className="text-ink/55">Received</dt><dd>{when(found.created_at)}</dd>
              {found.completed_at && <><dt className="text-ink/55">Finished</dt><dd>{when(found.completed_at)}</dd></>}
            </dl>
          </div>
        ) : (
          <div className="w-full max-w-[40rem] rounded-[1.75rem] bg-white p-6 shadow-[0_0_0_1px_rgba(13,13,13,.08)] sm:p-8">
            <p className="text-[16px] leading-[1.6] text-ink/75">{raw ? "We couldn't find a request with that code. Check it and try again, or write to us." : "Enter the confirmation code you were given."}</p>
            <form action="/data-deletion/status" className="mt-5 flex flex-col gap-3 sm:flex-row" method="get">
              <label className="sr-only" htmlFor="status-code">Confirmation code</label>
              <input autoCapitalize="characters" autoComplete="off" className="min-h-12 flex-1 rounded-full bg-paper px-5 font-label text-[14px] tracking-[0.08em] text-ink outline-none placeholder:text-ink/40 focus-visible:ring-2 focus-visible:ring-ink" defaultValue={typeof raw === "string" ? raw.slice(0, 40) : ""} id="status-code" maxLength={40} name="code" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" required spellCheck={false} />
              <button className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 text-[15px] font-semibold text-paper hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" type="submit">Check status</button>
            </form>
          </div>
        )}

        <p className="text-[15px] text-ink/65">Questions? <a className="font-semibold text-ink underline underline-offset-4" href="mailto:hello@setuvara.com">hello@setuvara.com</a> · <Link className="font-semibold text-ink underline underline-offset-4" href="/data-deletion">How deletion works</Link></p>
      </Shell>
    </section>
  );
}
