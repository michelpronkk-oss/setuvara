"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { endActiveLiveContext, saveActiveLiveContext } from "./actions";
import type { LiveContext } from "@/lib/live-context/model";
import { formatCountryName } from "@/lib/i18n/countries";
import { formatDate, formatTime } from "@/lib/i18n/locale";
import { useI18n } from "@/lib/i18n/provider";

const typeOptions = ["event", "meeting", "place", "custom"] as const;

function localDateTimeValue(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function localDateTimeToIso(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

export function LiveContextEditor({ active, recent, expiredActive }: { active: LiveContext | null; recent: LiveContext[]; expiredActive: LiveContext | null }) {
  const router = useRouter();
  const { locale, messages } = useI18n();
  const copy = messages.liveContext;
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const now = new Date();
  const defaultExpiry = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const labelClass = "mb-1.5 block text-sm font-semibold";
  const fieldClass = "min-h-12 w-full rounded-xl border border-black/15 bg-white px-3.5 text-base outline-none transition placeholder:text-black/40 focus:border-[#0d0d0d] focus-visible:ring-2 focus-visible:ring-[#ff5a4f]/60";
  const saveText = active ? copy.replace : copy.setActive;

  function submit(formData: FormData) {
    const startsAt = localDateTimeToIso(formData.get("startsAt"));
    const expiresAt = localDateTimeToIso(formData.get("expiresAt"));
    formData.set("startsAt", startsAt);
    formData.set("expiresAt", expiresAt);
    setStatus("");
    startTransition(async () => {
      const result = await saveActiveLiveContext(formData);
      setStatus(result.ok ? copy.active : (result.message ?? copy.error));
      if (result.ok) router.refresh();
    });
  }

  function end() {
    if (!active) return;
    setStatus("");
    startTransition(async () => {
      const result = await endActiveLiveContext(active.id);
      setStatus(result.ok ? copy.ended : copy.error);
      if (result.ok) router.refresh();
    });
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-[#0d0d0d] sm:px-6 sm:py-12">
      <p className="font-label text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">Setuvara</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.045em] sm:text-4xl">{copy.title}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-6 text-black/65">{copy.description}</p>

      {active ? (
        <section aria-label={copy.active} className="mt-8 rounded-[24px] bg-[#0d0d0d] p-5 text-[#f5f4ef] sm:p-6">
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-[#c7ff4a]">{copy.active}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">{active.label}</h2>
          <p className="mt-2 text-sm text-white/70">
            {[copy.type[active.context_type], active.venue, active.city, active.country_code ? formatCountryName(active.country_code, locale) : null]
              .filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-sm text-white/55">{copy.expiresAt}: {formatDate(active.expires_at, locale)} · {formatTime(active.expires_at, locale)}</p>
          <button className="mt-5 inline-flex min-h-11 items-center rounded-full border border-white/35 px-4 text-sm font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c7ff4a] disabled:opacity-60" disabled={pending} onClick={end} type="button">
            {copy.end}
          </button>
        </section>
      ) : (
        <section className="mt-8 rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] sm:p-6">
          <h2 className="text-lg font-semibold">{copy.none}</h2>
          <p className="mt-2 text-sm leading-6 text-black/60">{expiredActive ? copy.expired : copy.empty}</p>
        </section>
      )}

      <section className="mt-7 rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] sm:p-6">
        <h2 className="text-lg font-semibold">{saveText}</h2>
        <form action={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="live-context-type">{messages.encounter.liveContext}</label>
            <select className={fieldClass} id="live-context-type" name="type" required>
              {typeOptions.map((type) => <option key={type} value={type}>{copy.type[type]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="live-context-label">{copy.label}</label>
            <input autoComplete="off" className={fieldClass} id="live-context-label" maxLength={120} name="label" placeholder={copy.labelHint} required />
          </div>
          <div>
            <label className={labelClass} htmlFor="live-context-venue">{copy.venue}</label>
            <input autoComplete="off" className={fieldClass} id="live-context-venue" maxLength={120} name="venue" />
          </div>
          <div>
            <label className={labelClass} htmlFor="live-context-city">{copy.city}</label>
            <input autoComplete="address-level2" className={fieldClass} id="live-context-city" maxLength={80} name="city" />
          </div>
          <div>
            <label className={labelClass} htmlFor="live-context-country">{copy.country}</label>
            <input autoComplete="country" className={fieldClass} id="live-context-country" maxLength={2} name="countryCode" placeholder="NL" />
          </div>
          <div>
            <label className={labelClass} htmlFor="live-context-starts">{copy.startsAt}</label>
            <input className={fieldClass} id="live-context-starts" name="startsAt" type="datetime-local" />
          </div>
          <div>
            <label className={labelClass} htmlFor="live-context-expires">{copy.expiresAt}</label>
            <input className={fieldClass} defaultValue={localDateTimeValue(defaultExpiry.toISOString())} id="live-context-expires" name="expiresAt" required type="datetime-local" />
          </div>
          <label className="flex min-h-12 items-center gap-3 text-sm sm:col-span-2">
            <input className="size-5 accent-[#ff5a4f]" name="saveForLater" type="checkbox" />
            {copy.saved}
          </label>
          <p className="text-sm leading-5 text-black/55 sm:col-span-2">{copy.noLocation}</p>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#ff5a4f] px-5 text-sm font-semibold text-[#0d0d0d] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d0d0d] disabled:opacity-60" disabled={pending} type="submit">
              {pending ? messages.common.saving : saveText}
            </button>
            <p aria-live="polite" className="text-sm text-black/60">{status}</p>
          </div>
        </form>
      </section>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="font-label text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">{copy.recent}</h2>
          <ul className="mt-3 divide-y divide-black/10 rounded-2xl bg-white px-4">
            {recent.map((context) => (
              <li className="flex flex-wrap items-baseline justify-between gap-2 py-3" key={context.id}>
                <span className="min-w-0 truncate text-sm font-semibold">{context.label}</span>
                <span className="text-xs text-black/55">{[copy.type[context.context_type], context.city, context.country_code ? formatCountryName(context.country_code, locale) : null].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
