"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Segmented } from "@/app/app/identity/editor-ui";
import { inkButton, lineButton, Mono, StudioHead } from "@/components/creator/studio-ui";
import { feeLine, requirementList, SELLER_COUNTRIES, SELLER_STATE_COPY, type SellerState, type SellerStatus } from "@/lib/commerce/model";
import { relativeTime } from "@/lib/creator/studio";
import { shortDay, StateBadge } from "./ui";

const NOTICE: Record<string, string> = {
  returned: "Back from Stripe. This is the state Stripe reports now.",
  "sync-pending": "Back from Stripe. Checking your account didn't finish; press Check again.",
  unavailable: "Payments aren't open yet.",
  "stripe-error": "Stripe didn't respond. Try again in a moment.",
};

/**
 * Enable payments, finish or fix onboarding, and see what Stripe reports. Every
 * status shown comes from the Stripe account; nothing is marked ready on return.
 */
export function PaymentsStudio({ seller, state, open, notice, payoutsHref }: { seller: SellerStatus; state: SellerState; open: boolean; notice: string | null; payoutsHref: string }) {
  const router = useRouter();
  const account = seller.account;
  const [country, setCountry] = useState<string>(account?.country_code ?? "NL");
  const [businessType, setBusinessType] = useState<"individual" | "company">("individual");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const due = account ? requirementList([...account.past_due, ...account.currently_due]) : [];

  async function enable() {
    if (!terms) { setError("Accept the seller terms to continue."); return; }
    setBusy("enable"); setError(null);
    const response = await fetch("/api/commerce/payments/enable", { method: "POST", headers: { "Content-Type": "application/json", "x-setuvara-request": "same-origin" }, body: JSON.stringify({ country, businessType, acceptTerms: true }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { url?: string; error?: string } | null;
    if (response?.ok && result?.url) { window.location.assign(result.url); return; }
    setBusy(null);
    setError(result?.error ?? "That didn't work. Try again.");
  }
  async function check() {
    setBusy("check"); setError(null);
    const response = await fetch("/api/commerce/payments/refresh", { method: "POST", headers: { "x-setuvara-request": "same-origin" } }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusy(null);
    if (!response?.ok) setError(result?.error ?? "That didn't work. Try again.");
    router.refresh();
  }

  const connected = account && !account.disconnected_at;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
      <div className="min-w-0">
        <StudioHead creator title="Payments" />
        {notice && NOTICE[notice] && <p className="mb-4 rounded-2xl bg-[#FFE7B8] px-4 py-3 text-[15px]" role="status">{NOTICE[notice]}</p>}

        <section className="rounded-[26px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] md:p-7" data-payments-state={state}>
          <div className="flex flex-wrap items-center gap-3"><StateBadge state={state} />{connected && account.synced_at && <span className="text-[13px] text-black/50">Checked with Stripe {relativeTime(account.synced_at)}</span>}</div>
          <p className="mt-4 font-display text-[28px] font-bold leading-[1.05] tracking-[-0.04em] md:text-[34px]">{SELLER_STATE_COPY[state].line}</p>

          {connected && (
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-black/10 pt-5 sm:grid-cols-4">
              <Fact label="Card payments" value={account.charges_enabled && account.card_payments_status === "active" ? "On" : account.card_payments_status === "pending" ? "Pending" : "Off"} />
              <Fact label="Payouts" value={account.payouts_enabled ? "On" : "Paused"} />
              <Fact label="Country" value={SELLER_COUNTRIES.find((item) => item.code === account.country_code)?.name ?? account.country_code ?? "—"} />
              <Fact label="Payout currency" value={account.default_currency ?? "—"} />
            </dl>
          )}

          {connected && due.length > 0 && (
            <div className="mt-5 rounded-[18px] bg-[#F5F4EF] p-4">
              <p className="text-[15px] font-semibold">Stripe needs{account.current_deadline ? ` by ${shortDay(account.current_deadline)}` : ""}:</p>
              <ul className="mt-2 flex flex-wrap gap-2">{due.map((item) => <li className="rounded-full bg-white px-3 py-1 text-[14px]" key={item}>{item}</li>)}</ul>
              {account.errors.length > 0 && <p className="mt-3 text-[14px] text-[#B42318]">{account.errors[0].reason || "Stripe couldn't verify something you sent."}</p>}
            </div>
          )}

          {error && <p className="mt-4 text-[14px] font-medium text-[#B42318]" role="alert">{error}</p>}

          <div className="mt-6 flex flex-wrap gap-2">
            {!open ? (
              <p className="text-[15px] text-black/60">Payments open on Setuvara soon. Free products and shop links work today.</p>
            ) : !connected ? null : (
              <>
                {state !== "payments_enabled" && state !== "rejected" && (
                  // eslint-disable-next-line @next/next/no-html-link-for-pages -- a server redirect to Stripe, needs a full navigation
                  <a className={inkButton} href="/api/commerce/payments/onboarding">{account.details_submitted ? "Update details with Stripe" : "Continue setup with Stripe"}</a>
                )}
                <button className={lineButton} disabled={busy !== null} onClick={() => void check()} type="button">{busy === "check" ? "Checking…" : "Check again"}</button>
                <a className={lineButton} href={payoutsHref} rel="noreferrer" target="_blank">Stripe Dashboard ↗</a>
              </>
            )}
          </div>

          {open && !connected && (
            <div className="mt-6 grid gap-5 border-t border-black/10 pt-6" data-enable-payments>
              <div>
                <p className="mb-2 text-sm font-semibold">Where you or your business is based</p>
                <Segmented label="Country" onChange={setCountry} options={SELLER_COUNTRIES.map((item) => ({ value: item.code, label: item.name }))} value={country} />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">You sell as</p>
                <Segmented label="You sell as" onChange={(value) => setBusinessType(value as "individual" | "company")} options={[{ value: "individual", label: "Myself" }, { value: "company", label: "A company" }]} value={businessType} />
              </div>
              <label className="flex items-start gap-3 text-[15px] leading-[1.45]">
                <input checked={terms} className="mt-1 size-5 accent-[#0D0D0D]" onChange={(event) => setTerms(event.target.checked)} type="checkbox" />
                <span>I&apos;m the seller of what I list. I handle my own taxes, refunds and customer questions, and I agree to Setuvara&apos;s <a className="underline underline-offset-4" href="/terms" target="_blank">terms</a> and Stripe&apos;s <a className="underline underline-offset-4" href="https://stripe.com/legal/connect-account" rel="noreferrer" target="_blank">Connected Account Agreement</a>.</span>
              </label>
              <div><button className={inkButton} disabled={busy !== null} onClick={() => void enable()} type="button">{busy === "enable" ? "Opening Stripe…" : "Enable payments"}</button></div>
              <p className="text-[13px] leading-[1.5] text-black/55">Stripe opens in this tab to verify who you are and where to pay you. It takes a few minutes. Setuvara never sees your ID or bank details.</p>
            </div>
          )}
        </section>
      </div>

      <aside className="flex h-fit flex-col gap-4 rounded-[26px] bg-[#E8E2D4] p-6" style={{ clipPath: "polygon(0 0,100% 0,100% calc(100% - 44px),calc(100% - 25px) 100%,0 100%)" }}>
        <Mono className="text-black/70">How you get paid</Mono>
        <p className="font-display text-[26px] font-bold leading-[1.05] tracking-[-0.04em]">Your store, your Stripe account.</p>
        <ul className="grid gap-2 text-[15px] leading-[1.45] text-black/75">
          <li>Buyers pay you directly. Your name is on their receipt and card statement.</li>
          <li>Stripe&apos;s fee comes off each sale. Setuvara&apos;s fee: {seller.fees.length ? [...new Set(seller.fees.map((fee) => feeLine(fee)))].join(" · ") : "none"}.</li>
          <li>Refunds and disputes come from your Stripe balance. Setuvara returns its fee on refunds.</li>
          <li>You handle VAT or sales tax for what you sell. Ask an accountant if you&apos;re unsure.</li>
        </ul>
        <p className="border-t border-black/15 pt-4 text-[13px] leading-[1.45] text-black/60">Available in the United States, the United Kingdom and the Netherlands. More countries follow.</p>
      </aside>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt><Mono className="text-black/50">{label}</Mono></dt><dd className="mt-1 text-[16px] font-semibold">{value}</dd></div>;
}
