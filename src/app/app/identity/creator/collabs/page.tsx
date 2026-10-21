import type { Metadata } from "next";
import Link from "next/link";

import { DealsBoard } from "@/components/creator/deals/deals-client";
import { EmptyState, Mono, StudioHead, StudioPage, coralButton } from "@/components/creator/studio-ui";
import { DEAL_COLUMNS, dealTotals, formatMoney, type Deal } from "@/lib/creator/deals";
import { loadCreatorStudio } from "@/lib/creator/studio-server";

export const metadata: Metadata = { title: "Deals · Creator · Setuvara" };

/** Brand deals: every Collab request, moved from New to Paid, with what the creator agreed. */
export default async function CreatorDealsPage() {
  const studio = await loadCreatorStudio("/app/identity/creator/collabs");
  if (!studio.mode) return null;
  const { data, error } = await studio.supabase.from("creator_deals").select(DEAL_COLUMNS).order("last_activity_at", { ascending: false }).limit(1000);
  // The plan as the database decides it (private.member_plan), so the page and the rule agree.
  const plan = studio.limits.plan;
  if (error) return <StudioPage><StudioHead title="Deals" /><EmptyState body="Deals need a database update that hasn't reached this site yet." title="Not ready yet." /></StudioPage>;
  const deals = (data ?? []) as Deal[];
  const open = deals.filter((deal) => ["new", "talking", "booked", "completed"].includes(deal.stage)).length;
  const fresh = deals.filter((deal) => deal.stage === "new").length;
  const totals = dealTotals(deals);
  return (
    <StudioPage className="max-w-[1180px]">
      <StudioHead sub={deals.length ? `${open} open · ${fresh} new` : "Every Collab request on your Creator page becomes a deal here."} title="Deals" />
      {deals.length === 0 ? (
        <EmptyState action={<Link className={coralButton} href="/app/identity/creator/actions/new?kind=collab">Add a Collab Action</Link>} body="When a brand asks through your Collab Action, it lands here as a deal you can move from New to Paid." title="No deals yet." />
      ) : (
        <>
          {totals.length > 0 && (
            <dl className="mb-8 grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {totals.flatMap((row) => [
                <div className="rounded-[22px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] md:p-5" key={`${row.currency}-booked`}><dt><Mono className="text-black/50">Booked · {row.currency}</Mono></dt><dd className="mt-2 font-display text-[30px] font-bold leading-none tracking-[-0.05em]">{formatMoney(row.booked, row.currency)}</dd></div>,
                <div className="rounded-[22px] bg-[#0D0D0D] p-4 text-[#F5F4EF] md:p-5" key={`${row.currency}-paid`}><dt><Mono className="text-[#E8A6FF]">Paid · {row.currency}</Mono></dt><dd className="mt-2 font-display text-[30px] font-bold leading-none tracking-[-0.05em]">{formatMoney(row.paid, row.currency)}</dd></div>,
              ])}
              <p className="col-span-full text-[13px] text-black/50">From the fees you entered. Setuvara doesn&apos;t estimate deals from stated budgets.</p>
            </dl>
          )}
          <DealsBoard canNote={plan !== "free"} deals={deals} />
        </>
      )}
    </StudioPage>
  );
}
