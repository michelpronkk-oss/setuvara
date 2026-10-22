import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

type Step = { id: string; title: string; detail: string; href: string; done: boolean };

/**
 * First-run guide on Home: the five things that make a Setuvara worth sharing, in order. It shows only
 * what is real for this account and disappears once every step is done.
 */
export async function SetupSection({ userId, isPublished, bio }: { userId: string; isPublished: boolean; bio: string }) {
  const supabase = await createClient();
  const { data: personal } = await supabase.from("profile_modes").select("id, image_path, settings").eq("profile_id", userId).eq("slug", "personal").maybeSingle();
  if (!personal) return null;
  const [{ count: links }, { count: blocks }, { count: people }] = await Promise.all([
    supabase.from("profile_links").select("id", { count: "exact", head: true }).eq("profile_id", userId).eq("mode_id", personal.id),
    supabase.from("profile_blocks").select("id", { count: "exact", head: true }).eq("profile_id", userId).eq("mode_id", personal.id),
    supabase.from("connections").select("id", { count: "exact", head: true }),
  ]);
  const note = typeof (personal.settings as Record<string, unknown> | null)?.note === "string" && ((personal.settings as Record<string, string>).note).trim();
  const steps: Step[] = [
    { id: "photo", title: "Add your photo", detail: "People remember a face.", href: "/app/identity?mode=personal&section=profile", done: Boolean(personal.image_path) },
    { id: "note", title: "Say who you are", detail: "One line under your name.", href: "/app/identity?mode=personal&section=profile", done: Boolean(bio.trim() || note) },
    { id: "content", title: "Add a link or two", detail: "Instagram, music, a website.", href: "/app/identity?mode=personal&section=links", done: (links ?? 0) + (blocks ?? 0) > 0 },
    { id: "publish", title: "Publish your Setuvara", detail: "Your link opens for everyone.", href: "/app/identity?mode=personal&section=share", done: isPublished },
    { id: "connect", title: "Make your first connection", detail: "Let someone scan your QR.", href: "/app/connections", done: (people ?? 0) > 0 },
  ];
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;
  const next = steps.find((step) => !step.done)!;

  return (
    <section aria-labelledby="sv-setup" className="rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.035em]" id="sv-setup">Get set up</h2>
        <p className="font-label text-[11px] tabular-nums text-black/50">{done} of {steps.length}</p>
      </div>
      <div aria-hidden="true" className="mt-3 flex gap-1">
        {steps.map((step) => <span className={`h-1 flex-1 rounded-full ${step.done ? "bg-[#0D0D0D]" : step === next ? "bg-[#FF5A4F]" : "bg-black/[0.08]"}`} key={step.id} />)}
      </div>
      <ol className="mt-4 flex flex-col">
        {steps.map((step) => {
          const current = step === next;
          return (
            <li key={step.id}>
              <Link aria-current={current ? "step" : undefined} className={`group flex min-h-[52px] items-center gap-3.5 rounded-[14px] px-2 transition-colors focus-visible:outline-2 ${current ? "bg-[#F5F4EF]" : "hover:bg-black/[0.03]"}`} href={step.href}>
                <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${step.done ? "bg-[#0D0D0D] text-[#F5F4EF]" : current ? "bg-[#FF5A4F] text-[#0D0D0D]" : "shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.2)]"}`}>
                  {step.done ? <svg className="size-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10" /></svg> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] ${step.done ? "text-black/45 line-through decoration-black/25" : "font-semibold"}`}>{step.title}<span className="sr-only">{step.done ? ", done" : ""}</span></span>
                  {current && <span className="block text-[13px] text-black/55">{step.detail}</span>}
                </span>
                {current && <span aria-hidden="true" className="text-[15px] font-semibold transition-transform group-hover:translate-x-0.5">→</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
