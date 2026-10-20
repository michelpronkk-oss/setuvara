"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, TextInput } from "@/app/app/identity/editor-ui";
import { formatMoney, parseMoney, relativeTime, type KitRate, type MediaKit } from "@/lib/creator/studio";
import { createClient } from "@/lib/supabase/client";
import { MediaKitDocument, type KitDocument } from "./media-kit-document";
import { inkButton, lineButton, Mono } from "./studio-ui";

const INCLUDE = [
  { key: "show_platforms", label: "Platforms" },
  { key: "show_partners", label: "Past partners" },
  { key: "show_rates", label: "Rates" },
  { key: "show_contact", label: "Contact email" },
] as const;

export function KitStudio({ profileId, initial, base, kitUrl }: { profileId: string; initial: MediaKit; base: Omit<KitDocument, "partners" | "rates" | "contactEmail" | "languages" | "updatedAt" | "kitUrl">; kitUrl: string | null }) {
  const router = useRouter();
  const [kit, setKit] = useState<MediaKit>(initial);
  const [partner, setPartner] = useState("");
  const [rate, setRate] = useState({ label: "", price: "" });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const dirty = JSON.stringify(kit) !== JSON.stringify(initial);

  const doc: KitDocument = {
    ...base,
    languages: kit.languages,
    platforms: kit.show_platforms ? base.platforms : [],
    partners: kit.show_partners ? kit.partners : [],
    rates: kit.show_rates ? kit.rates : [],
    contactEmail: kit.show_contact ? kit.contact_email : null,
    kitUrl,
    updatedAt: kit.updated_at ?? null,
  };

  async function save() {
    setStatus("saving");
    const { updated_at: _ignored, ...row } = kit;
    void _ignored;
    const { error } = await createClient().from("creator_media_kits").upsert({ ...row, contact_email: row.contact_email?.trim() || null, user_id: profileId }, { onConflict: "user_id" });
    if (error) { setStatus("error"); return; }
    setStatus("saved");
    router.refresh();
  }

  function addPartner() {
    const name = partner.trim().slice(0, 40);
    if (!name || kit.partners.includes(name) || kit.partners.length >= 12) return;
    setKit({ ...kit, partners: [...kit.partners, name] });
    setPartner("");
  }
  function addRate() {
    const amount = parseMoney(rate.price);
    const label = rate.label.trim().slice(0, 40);
    if (!amount || !label || kit.rates.length >= 6) return;
    const next: KitRate = { label, amount_minor: amount, currency: "EUR" };
    setKit({ ...kit, rates: [...kit.rates, next] });
    setRate({ label: "", price: "" });
  }
  async function copy() {
    if (!kitUrl) return;
    try { await navigator.clipboard.writeText(kitUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* Clipboard can be blocked; the link stays visible. */ }
  }

  return (
    <div className="-mx-3.5 grid gap-8 bg-[#E6E4DC] px-3.5 py-6 md:-mx-8 md:px-8 md:py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 print:m-0 print:block print:bg-white print:p-0">
      <div className="min-w-0"><MediaKitDocument doc={doc} /></div>
      <aside className="flex flex-col gap-5 print:hidden">
        <div>
          <h1 className="font-display text-[34px] font-bold leading-none tracking-[-0.05em]">Media kit</h1>
          <p className="mt-3 text-[15px] leading-[1.5] text-black/70">Built from your Creator page and what you add here. Partners always see the latest version.</p>
        </div>
        <div className="grid gap-2">
          <button className={`${inkButton} w-full`} disabled={!kitUrl} onClick={() => void copy()} type="button">{copied ? "Copied" : "Copy kit link"}</button>
          <button className={`${lineButton} w-full`} onClick={() => window.print()} type="button">Download PDF</button>
          {!kitUrl && <p className="text-[13px] text-black/60">Turn Creator on to share your kit.</p>}
        </div>

        <section className="border-t border-black/15 pt-4">
          <Mono className="mb-1 text-black/60">Include</Mono>
          <ul className="divide-y divide-black/10">
            {INCLUDE.map((item) => {
              const on = kit[item.key];
              return (
                <li key={item.key}>
                  <button aria-checked={on} className="flex min-h-12 w-full items-center justify-between text-left text-[16px] font-medium focus-visible:outline-2" onClick={() => setKit({ ...kit, [item.key]: !on })} role="checkbox" type="button">
                    {item.label}
                    <span aria-hidden="true" className={`grid size-[22px] place-items-center rounded-[6px] text-[12px] ${on ? "bg-[#0D0D0D] text-white" : "shadow-[inset_0_0_0_1.5px_#0D0D0D]"}`}>{on ? "✓" : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="grid gap-4 border-t border-black/15 pt-4">
          <Field htmlFor="kit-languages" label="Languages"><TextInput id="kit-languages" maxLength={60} onChange={(event) => setKit({ ...kit, languages: event.target.value })} placeholder="EN / PT" value={kit.languages} /></Field>
          <div>
            <p className="mb-2 text-sm font-semibold">Past partners</p>
            <ul className="mb-2 flex flex-wrap gap-1.5">{kit.partners.map((name) => <li key={name}><button aria-label={`Remove ${name}`} className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] hover:line-through" onClick={() => setKit({ ...kit, partners: kit.partners.filter((item) => item !== name) })} type="button">{name} ×</button></li>)}</ul>
            <div className="flex gap-2"><TextInput aria-label="Partner name" maxLength={40} onChange={(event) => setPartner(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addPartner(); } }} placeholder="Brand or publication" value={partner} /><button className={lineButton} disabled={kit.partners.length >= 12} onClick={addPartner} type="button">Add</button></div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Starting rates</p>
            <ul className="mb-2 grid gap-1">{kit.rates.map((item, index) => <li className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm" key={`${item.label}${index}`}><span><span className="font-semibold">{formatMoney(item.amount_minor, item.currency)}</span> · {item.label}</span><button aria-label={`Remove ${item.label}`} className="text-black/50 hover:text-black" onClick={() => setKit({ ...kit, rates: kit.rates.filter((_, at) => at !== index) })} type="button">×</button></li>)}</ul>
            <div className="grid grid-cols-[1fr_96px_auto] gap-2"><TextInput aria-label="What the rate is for" maxLength={40} onChange={(event) => setRate({ ...rate, label: event.target.value })} placeholder="Instagram Reel" value={rate.label} /><TextInput aria-label="Price in euro" inputMode="decimal" onChange={(event) => setRate({ ...rate, price: event.target.value })} placeholder="€2,800" value={rate.price} /><button className={lineButton} disabled={kit.rates.length >= 6} onClick={addRate} type="button">Add</button></div>
          </div>
          <Field hint={kit.show_contact ? "Shown on the kit" : "Turn on Contact email to show it"} htmlFor="kit-email" label="Contact email"><TextInput autoComplete="email" id="kit-email" inputMode="email" maxLength={254} onChange={(event) => setKit({ ...kit, contact_email: event.target.value })} placeholder="studio@example.com" value={kit.contact_email ?? ""} /></Field>
        </section>

        <div className="flex items-center gap-3 rounded-full bg-[#E6E4DC] py-1 max-lg:sticky max-lg:bottom-[calc(84px+env(safe-area-inset-bottom))]">
          <button className={`${inkButton} flex-1`} disabled={!dirty || status === "saving"} onClick={() => void save()} type="button">{status === "saving" ? "Saving…" : "Save kit"}</button>
          <span aria-live="polite" className="text-[13px] text-black/60">{status === "error" ? "Not saved. Try again." : status === "saved" && !dirty ? "Saved" : kit.updated_at ? `Updated ${relativeTime(kit.updated_at)}` : ""}</span>
        </div>
      </aside>
    </div>
  );
}
