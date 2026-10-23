"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { confirmDialog } from "@/components/app/confirm-dialog";
import { formatChangeDate, HANDLE_CHANGE_RULE, nextWindowFromNow, OPEN_CHANGE_STATE, parseChangeState, type ChangeState } from "@/lib/handles/change-window";
import { handleErrorMessage, parseModeHandleState, type HandleCheck, type ModeHandleSlug } from "@/lib/handles/mode-handle";
import { createClient } from "@/lib/supabase/client";
import type { EditorApi } from "./editor-types";
import { Pill, Toggle, modeMeta } from "./editor-ui";

const checkCopy: Record<HandleCheck | "checking", { text: string; tone: "ok" | "bad" | "quiet" }> = {
  checking: { text: "Checking…", tone: "quiet" },
  free: { text: "Available ✓", tone: "ok" },
  yours: { text: "Already yours ✓", tone: "ok" },
  taken: { text: "That name is taken.", tone: "bad" },
  reserved: { text: "That name is reserved for Setuvara.", tone: "bad" },
  invalid: { text: "Use 3–24 lowercase letters, numbers or _.", tone: "quiet" },
};

/**
 * "Your public link": a Business or Creator Mode can claim setuvara.com/<handle>. Claiming only
 * reserves the name; the link opens once the owner turns it on, and search engines list it only
 * if they also allow that. Every rule is enforced by the database; this is the friendly face.
 */
export function PublicLinkCard({ api, slug, onCopy, onShare, onQr }: { api: EditorApi; slug: ModeHandleSlug; onCopy: () => void; onShare: () => void; onQr: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const state = api.modeHandles[slug] ?? null;
  const [editing, setEditing] = useState(!state);
  const [draft, setDraft] = useState(state?.handle ?? "");
  const [remote, setRemote] = useState<{ name: string; result: HandleCheck | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  // One claim or change every 30 days (plus one switch back); the database enforces it, this only says when.
  const [change, setChange] = useState<ChangeState>(OPEN_CHANGE_STATE);
  const nextChangeAt = change.nextChangeAt;
  const inputId = useId();
  const name = modeMeta[slug].name;
  const short = api.shortUrl(slug)?.replace(/^https?:\/\//, "") ?? null;
  const host = api.publicOrigin.replace(/^https?:\/\//, "");
  const offline = !api.profile.is_published || !api.mode.is_enabled;
  const candidate = draft.trim().toLowerCase();

  const wellFormed = /^[a-z0-9_]{3,24}$/.test(candidate);
  const asking = editing && wellFormed && candidate !== state?.handle;
  const check: HandleCheck | "checking" | null = !editing || !candidate || candidate === state?.handle ? null
    : !wellFormed ? "invalid"
    : remote?.name === candidate ? remote.result : "checking";

  // Availability while typing, debounced; the claim re-checks under a lock either way.
  useEffect(() => {
    if (!asking) return;
    let live = true;
    const timer = window.setTimeout(async () => {
      const { data, error: checkError } = await supabase.rpc("check_handle", { p_handle: candidate });
      if (live) setRemote({ name: candidate, result: checkError ? null : (data as HandleCheck) });
    }, 350);
    return () => { live = false; window.clearTimeout(timer); };
  }, [asking, candidate, supabase]);

  useEffect(() => {
    let live = true;
    void supabase.rpc("handle_change_state", { p_mode: slug }).then(({ data }) => { if (live) setChange(parseChangeState(data)); });
    return () => { live = false; };
  }, [slug, supabase]);

  async function claim(target = candidate) {
    const switchBack = target === change.switchBack;
    if (state) {
      const until = formatChangeDate(nextWindowFromNow());
      const sure = await confirmDialog(switchBack ? {
        title: `Switch back to ${host}/${target}?`,
        body: `${host}/${target} becomes this Mode’s link again and ${host}/${state.handle} goes back to being free. You can’t change this link again until ${until}.`,
        action: "Switch back",
        cancel: "Keep it",
      } : {
        title: "Change your public link?",
        body: `${host}/${state.handle} becomes ${host}/${target}. The old link stays yours for 30 days and redirects here; after that, someone else can claim it. You can’t change this link again until ${until}, but you can switch back once before then.`,
        action: "Change link",
        cancel: "Keep it",
      });
      if (!sure) return;
    }
    setBusy(true);
    setError(null);
    const { data, error: claimError } = await supabase.rpc("claim_mode_handle", { p_mode: slug, p_handle: target });
    setBusy(false);
    const next = claimError ? null : parseModeHandleState(data);
    if (!next) {
      setError(handleErrorMessage(claimError?.message));
      if (claimError?.message?.includes("handle_change_limit")) void supabase.rpc("handle_change_state", { p_mode: slug }).then(({ data: when }) => setChange(parseChangeState(when)));
      return;
    }
    api.setModeHandle(slug, next);
    setChange({ nextChangeAt: nextWindowFromNow().toISOString(), switchBack: state && !switchBack ? state.handle : null });
    setEditing(false);
    api.toast(switchBack ? `Back to ${host}/${next.handle}.` : state ? `Changed. ${host}/${state.handle} now points to the new link.` : `${host}/${next.handle} is yours.`);
  }

  async function setVisibility(live: boolean, indexed: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: saveError } = await supabase.rpc("set_mode_handle_visibility", { p_mode: slug, p_live: live, p_indexed: indexed });
    setBusy(false);
    const next = saveError ? null : parseModeHandleState(data);
    if (!next) { setError(handleErrorMessage(saveError?.message)); return; }
    api.setModeHandle(slug, next);
  }

  async function release() {
    setBusy(true);
    const { error: releaseError } = await supabase.rpc("release_mode_handle", { p_mode: slug });
    setBusy(false);
    setConfirmRelease(false);
    if (releaseError) { setError(handleErrorMessage(releaseError.message)); return; }
    api.setModeHandle(slug, null);
    setDraft(state?.handle ?? "");
    setEditing(true);
    api.toast("Link released. The name stays yours for 30 days if you want it back.");
  }

  const status = check ? checkCopy[check] : null;
  const canClaim = !busy && !nextChangeAt && (check === "free" || check === "yours");

  return (
    <section aria-label="Your public link" className="@container/handle order-1 min-w-0 rounded-[22px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] @min-[560px]/share:order-none @min-[760px]/share:p-5" data-public-link={state ? (state.is_live ? "live" : "claimed") : "none"}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">Your public link</p>
        {state && !editing && <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${state.is_live ? "bg-[#2BB673]/[0.14] text-[#17713f]" : "bg-black/[0.06] text-black/55"}`}>{state.is_live ? "Live" : "Not public"}</span>}
      </div>

      {editing ? (
        <>
          <p className="mt-1 text-[12.5px] leading-5 text-black/55">
            {state ? `Pick a new name. ${host}/${state.handle} stays yours for 30 days and points here. ${HANDLE_CHANGE_RULE}` : nextChangeAt ? `You changed this link recently. You can claim a new one on ${formatChangeDate(nextChangeAt)}.` : `Give ${name} Mode a name of its own. Claiming it doesn’t make anything public. ${HANDLE_CHANGE_RULE}`}
          </p>
          <label className="sr-only" htmlFor={inputId}>Handle</label>
          <div className="mt-3 flex min-h-[52px] items-center rounded-2xl bg-[#F5F4EF] px-4 focus-within:outline-2 focus-within:outline-offset-2">
            <span aria-hidden="true" className="shrink-0 text-[16px] text-black/40">{host}/</span>
            <input
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              className="min-w-0 flex-1 bg-transparent py-3 text-[16px] font-semibold outline-none placeholder:font-normal placeholder:text-black/30"
              id={inputId}
              maxLength={24}
              onChange={(event) => { setDraft(event.target.value.replace(/[^A-Za-z0-9_]/g, "").toLowerCase()); setError(null); }}
              onKeyDown={(event) => { if (event.key === "Enter" && canClaim) void claim(); }}
              placeholder={slug === "business" ? "yourstudio" : "yourname_creates"}
              spellCheck={false}
              value={draft}
            />
          </div>
          <p aria-live="polite" className={`mt-2 min-h-5 text-[12.5px] ${error || status?.tone === "bad" ? "text-[#c2372e]" : status?.tone === "ok" ? "text-[#17713f]" : "text-black/50"}`} data-handle-check={check ?? ""}>{error ?? status?.text ?? ""}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Pill className="!min-h-11 !px-6" disabled={!canClaim} onClick={() => void claim()} variant="ink">{busy ? "Saving…" : state ? "Save handle" : "Claim link"}</Pill>
          {state && <button className="text-[12.5px] font-semibold text-black/60 underline underline-offset-4 hover:text-black" onClick={() => { setEditing(false); setDraft(state.handle); setError(null); }} type="button">Keep {state.handle}</button>}
          </div>
        </>
      ) : state && (
        <>
          <div className="mt-3 flex min-h-[52px] items-center gap-2 rounded-2xl bg-[#F5F4EF] py-1.5 pl-4 pr-1.5">
            <span className="min-w-0 flex-1 truncate font-label text-[12.5px]" data-handle-url>{host}/<b className="font-semibold">{state.handle}</b></span>
            <button className="min-h-10 shrink-0 rounded-full px-3.5 text-[12.5px] font-semibold text-black/65 hover:bg-black/[0.06] disabled:cursor-not-allowed disabled:text-black/35 disabled:hover:bg-transparent" disabled={Boolean(nextChangeAt)} onClick={() => { setEditing(true); setRemote(null); }} type="button">Change handle</button>
          </div>
          {nextChangeAt && <p className="mt-2 text-[12px] leading-[1.45] text-black/55" data-handle-lock>You can change this handle again on {formatChangeDate(nextChangeAt)}.{change.switchBack && <> <button className="font-semibold text-black underline underline-offset-4 disabled:opacity-40" data-handle-switch-back={change.switchBack} disabled={busy} onClick={() => void claim(change.switchBack ?? undefined)} type="button">Switch back to {change.switchBack}</button></>}</p>}
          {state.is_live && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Pill className="!min-h-11 !px-2" onClick={onCopy} variant="ink">Copy URL</Pill>
              <Pill className="!min-h-11 !px-2" onClick={onShare} variant="coral">Share URL</Pill>
              <Pill className="!min-h-11 !px-2" onClick={onQr}>QR code</Pill>
            </div>
          )}

          <div className="mt-4 divide-y divide-black/[0.07] border-t border-black/[0.07]">
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">Public link</p>
                <p className="mt-0.5 text-[12px] leading-[1.45] text-black/55">
                  {state.is_live
                    ? offline ? `On, but it won’t open until ${!api.profile.is_published ? "you publish your Setuvara" : `${name} Mode is on`}.` : `Anyone with ${host}/${state.handle} can open ${name} Mode.`
                    : `Off. ${name} Mode stays private: only your shortlink opens it.`}
                </p>
              </div>
              <Toggle disabled={busy} label="Public link" on={state.is_live} onChange={(on) => void setVisibility(on, on && state.search_indexed)} />
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">Show in search engines</p>
                <p className="mt-0.5 text-[12px] leading-[1.45] text-black/55">{state.is_live ? (state.search_indexed ? "Google and others may list this page." : "Off. Search engines are asked not to list it.") : "Turn the public link on first."}</p>
              </div>
              <Toggle disabled={busy || !state.is_live} label="Show in search engines" on={state.search_indexed} onChange={(on) => void setVisibility(true, on)} />
            </div>
          </div>
          {error && <p className="mt-2 text-[12.5px] text-[#c2372e]" role="alert">{error}</p>}

          {confirmRelease
            ? <div className="mt-3 rounded-2xl bg-[#FF5A4F]/[0.1] px-4 py-3" data-handle-release="confirm">
                <p className="text-[12.5px] leading-5">Release {host}/{state.handle}? It stops opening. The name stays yours for 30 days, then someone else can claim it.</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Pill className="!min-h-10 !px-4" disabled={busy} onClick={() => void release()} variant="ink">Release link</Pill>
                  <Pill className="!min-h-10 !px-4" disabled={busy} onClick={() => setConfirmRelease(false)}>Keep it</Pill>
                </div>
              </div>
            : <button className="mt-1 text-[12.5px] font-semibold text-black/50 underline underline-offset-4 hover:text-black" onClick={() => setConfirmRelease(true)} type="button">Release this link</button>}
        </>
      )}

      {short && !state?.is_live && <p className="mt-3 border-t border-black/[0.07] pt-3 text-[12px] leading-[1.45] text-black/50">Your shortlink <span className="font-label text-black/70">{short}</span> keeps working, and so do QR codes and Tap you’ve already shared.</p>}
    </section>
  );
}
