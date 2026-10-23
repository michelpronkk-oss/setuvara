"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

import { nameFontClasses } from "@/components/profile/name-fonts";
import { APPEARANCE_NAMES, previewAppearance } from "@/components/profile/appearance";
import { appearanceTheme } from "@/components/profile/appearance-theme";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import type { AppearanceId, ProfileLink, ProfileMode } from "@/components/profile/types";
import { detectProvider } from "@/lib/links/providers";

/**
 * "Bring your link in bio": paste a Linktree, Beacons, Carrd or any page and see it as a
 * Setuvara page, drawn by the real renderer, cycling through Looks until you pick one. The
 * page is read once by /api/tools/page-import; nothing is saved. Claiming carries only the name.
 */

type Imported = { name: string; bio: string; image: string | null; links: { title: string; url: string }[] };

const LOOKS: AppearanceId[] = ["immersive", "glow", "clean", "film", "stack", "aura"];
const FREE = new Set<AppearanceId>(["immersive", "clean"]);
const mono = "font-label text-[10px] font-medium uppercase tracking-[0.16em]";

const handleFrom = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9_]+/g, "").slice(0, 24);

function Connect() {
  return (
    <span className="relative isolate inline-flex h-[var(--sv-connect-h,52px)] w-[var(--sv-connect-w,100%)] min-w-11 items-center gap-2.5 overflow-hidden rounded-[var(--sv-connect-radius,999px)] bg-[var(--sv-connect-bg)] px-[var(--sv-connect-px,20px)] text-[16px] font-semibold text-[var(--sv-connect-fg)] shadow-[var(--sv-connect-edge,none)] after:content-[var(--sv-connect-arrow,none)]" style={{ justifyContent: "var(--sv-connect-justify, center)", "--sv-connect-bg": "var(--sv-connect-fill, #FF5A4F)", "--sv-connect-fg": "var(--sv-connect-ink, #0D0D0D)" } as CSSProperties}>
      <span>Connect</span>
    </span>
  );
}

export function LinkImport({ tone = "white" }: { tone?: "white" | "paper" }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<Imported | null>(null);
  const [look, setLook] = useState<AppearanceId>("immersive");
  const [picked, setPicked] = useState(false);

  // Until a Look is picked, show the range: one Look after another.
  useEffect(() => {
    if (!page || picked) return;
    const timer = window.setInterval(() => setLook((current) => LOOKS[(LOOKS.indexOf(current) + 1) % LOOKS.length]), 2600);
    return () => window.clearInterval(timer);
  }, [page, picked]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setState("loading");
    setError(null);
    try {
      const response = await fetch(`/api/tools/page-import?url=${encodeURIComponent(url.trim())}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "We couldn’t read that page.");
      setPage(body as Imported);
      setPicked(false);
      setLook("immersive");
      setState("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t read that page.");
      setState("idle");
    }
  }

  const handle = page ? handleFrom(page.name) : "";
  const links: ProfileLink[] = (page?.links ?? []).flatMap((item, index) => {
    const found = detectProvider(item.url);
    return found ? [{ id: `import-${index}`, title: item.title, url: item.url, link_type: found.provider.id, is_visible: true, sort_order: index }] : [];
  });
  const mode: ProfileMode = {
    id: "import", slug: "personal", label: "Personal", is_enabled: true,
    settings: page?.bio ? { location: page.bio.slice(0, 60) } : {},
    appearance: { theme: look, accent: "#FF5A4F", socialPlacement: "both" },
    image_path: page?.image ?? null, image_url: page?.image ?? null,
    links, blocks: [],
  };
  const resolved = previewAppearance(mode);
  const field = tone === "white" ? "bg-paper" : "bg-white";

  return (
    <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-6">
      <div className="lg:col-span-6">
        <form className={`flex h-[60px] w-full max-w-[560px] items-center gap-1 rounded-full pl-5 pr-1.5 shadow-[inset_0_0_0_1.5px_#0d0d0d] focus-within:shadow-[inset_0_0_0_2.5px_#0d0d0d] ${field}`} onSubmit={submit}>
          <label className="sr-only" htmlFor="link-import">Your link in bio</label>
          <input autoCapitalize="none" autoComplete="url" className="min-w-0 flex-1 bg-transparent font-label text-[15px] outline-none placeholder:text-ink/35" id="link-import" inputMode="url" onChange={(event) => setUrl(event.target.value)} placeholder="linktr.ee/yourname" value={url} />
          <button className="h-12 shrink-0 rounded-full bg-ink px-5 text-[15px] font-semibold text-paper disabled:opacity-60" disabled={state === "loading"} type="submit">{state === "loading" ? "Reading…" : "Show me"}</button>
        </form>
        <p className={`${mono} mt-4 text-ink/45`}>Linktree · Beacons · Carrd · any public page · nothing is saved</p>
        {error ? <p className="mt-4 max-w-[520px] rounded-[16px] bg-[#FFF1EF] px-4 py-3 text-[14px] text-[#a43d36]" role="alert">{error}</p> : null}

        {page ? (
          <div className="mt-8">
            <p className={`${mono} text-ink/45`}>{picked ? "Your Look" : "Trying every Look · tap one to keep it"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {LOOKS.map((id) => (
                <button aria-pressed={look === id} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition ${look === id ? "bg-ink text-paper" : `${field} text-ink hover:bg-[#ECEAE3]`}`} key={id} onClick={() => { setLook(id); setPicked(true); }} type="button">
                  {APPEARANCE_NAMES[id]}{FREE.has(id) ? null : <span className={`rounded-full px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.12em] ${look === id ? "bg-coral text-ink" : "bg-[#FFF1EF] text-[#a43d36]"}`}>Plus</span>}
                </button>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a className="inline-flex min-h-12 items-center rounded-full bg-coral px-6 text-[15px] font-semibold text-ink hover:bg-[#ff6e64]" href={`/signup${handle.length >= 3 ? `?username=${handle}` : ""}`}>Claim {handle.length >= 3 ? `setuvara.com/${handle}` : "your name"} →</a>
              <span className="text-[13px] text-ink/55">Free, with all four Modes. You add your links for real after.</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="lg:col-span-6">
        <div className={`${nameFontClasses} relative mx-auto h-[600px] w-[290px] rounded-[48px] bg-[#1b1b1b] p-[10px] shadow-[0_50px_90px_-40px_rgba(13,13,13,.6),inset_0_0_0_1.5px_rgba(255,255,255,.08)]`}>
          <div className="relative h-full w-full overflow-y-auto overflow-x-hidden rounded-[38px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_[data-floating-connect]]:hidden" style={{ background: page ? appearanceTheme(resolved.id, resolved.accent).base : "#F5F4EF" }}>
            {page ? (
              <div key={look} className="[animation:fade-in_.5s_ease-out]" style={{ width: 390, zoom: 270 / 390, "--profile-vh": "844px" } as CSSProperties}>
                <ProfileRenderer mode={mode} nameAs="p" plan="pro" previewLook={resolved} profile={{ id: "import", username: handle || "you", display_name: page.name, bio: "", is_published: true }} sound="off" viewerState="visitor_unconnected" visitorAction={<Connect />} />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
                <span className="grid size-16 place-items-center rounded-full bg-ink/[0.06] text-[26px]">↗</span>
                <p className="text-[15px] font-semibold">Your page appears here</p>
                <p className="text-[13px] leading-[1.5] text-ink/55">Paste the link from your bio. We read your name, picture and links, and draw them in every Look.</p>
              </div>
            )}
            <span className="pointer-events-none absolute left-1/2 top-2.5 h-[24px] w-[80px] -translate-x-1/2 rounded-full bg-[#0a0a0a]" />
          </div>
        </div>
      </div>
    </div>
  );
}
