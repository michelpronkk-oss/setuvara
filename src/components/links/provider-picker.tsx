"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { LINK_CATEGORIES, LINK_PROVIDERS, MODE_LINK_SUGGESTIONS, providerSearchText, type LinkMode, type LinkProvider, type LinkProviderId } from "@/lib/links/providers";
import { ProviderMark } from "./provider-mark";

export function ProviderPicker({ mode, onSelect, selectedProviderId }: { mode: LinkMode; onSelect: (provider: LinkProvider) => void; selectedProviderId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef(false);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = useMemo(() => LINK_PROVIDERS.filter((provider) => provider.id !== "calendar" && providerSearchText(provider).includes(normalizedQuery)), [normalizedQuery]);
  const suggestions = MODE_LINK_SUGGESTIONS[mode]
    .map((id) => LINK_PROVIDERS.find((provider) => provider.id === id))
    .filter((provider): provider is LinkProvider => Boolean(provider));
  const selectedProvider = LINK_PROVIDERS.find((provider) => provider.id === selectedProviderId);

  useEffect(() => {
    if (open) {
      returnFocusRef.current = true;
      searchRef.current?.focus();
      const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
    if (returnFocusRef.current) {
      triggerRef.current?.focus();
      returnFocusRef.current = false;
    }
  }, [open]);

  function keepFocusInDialog(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function choose(provider: LinkProvider) {
    onSelect(provider);
    setOpen(false);
    setQuery("");
  }

  return <>
    <button aria-haspopup="dialog" className="inline-flex min-h-12 items-center gap-3 rounded-xl border border-black/15 bg-white px-3 text-left text-sm font-semibold hover:border-black/30 focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => setOpen(true)} ref={triggerRef} type="button">
      {selectedProvider ? <ProviderMark className="size-8 rounded-lg" icon={selectedProvider.icon} label={selectedProvider.name} /> : <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-black/[0.055] text-base">＋</span>}
      {selectedProvider ? <><span>{selectedProvider.name}</span><span className="text-xs font-medium text-black/45">Change</span></> : "Choose a provider"}
    </button>
    {open && <div className="fixed inset-0 z-[80] flex items-end bg-[#0d0d0d]/45 p-0 sm:items-center sm:justify-center sm:p-5" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section aria-labelledby="provider-picker-title" aria-modal="true" className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[1.7rem] bg-[#f5f4ef] shadow-2xl sm:max-h-[min(84dvh,760px)] sm:max-w-2xl sm:rounded-[1.7rem]" onKeyDown={keepFocusInDialog} ref={dialogRef} role="dialog" tabIndex={-1}>
        <header className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4 sm:px-6">
          <div><p className="text-[10px] font-bold tracking-[0.19em] text-[#006448]">ADD TO {mode.toUpperCase()} MODE</p><h2 className="mt-1 text-xl font-semibold tracking-tight" id="provider-picker-title">Choose a link</h2></div>
          <button aria-label="Close link picker" className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-black/5 focus-visible:outline-2" onClick={() => setOpen(false)} type="button">×</button>
        </header>
        <div className="border-b border-black/10 px-5 py-4 sm:px-6">
          <label className="sr-only" htmlFor="provider-search">Search links</label>
          <input autoComplete="off" className="min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 text-base outline-none focus:border-black" id="provider-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search social, contact, or actions" ref={searchRef} value={query} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          {!normalizedQuery && <section aria-labelledby="provider-suggested" className="mb-6"><h3 className="mb-3 text-xs font-semibold" id="provider-suggested">Suggested for {mode[0].toUpperCase() + mode.slice(1)}</h3><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{suggestions.map((provider) => <ProviderOption key={provider.id} provider={provider} onClick={choose} />)}</div></section>}
          {LINK_CATEGORIES.map((category) => {
            const items = filtered.filter((provider) => provider.category === category);
            if (!items.length) return null;
            return <section aria-labelledby={`provider-category-${category}`} className="mb-6" key={category}><h3 className="mb-2 text-xs font-semibold text-black/55" id={`provider-category-${category}`}>{category}</h3><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{items.map((provider) => <ProviderOption key={provider.id} provider={provider} onClick={choose} />)}</div></section>;
          })}
          {!filtered.length && <p className="rounded-xl bg-white px-4 py-5 text-sm text-black/55">No links match “{query}”. Try a different name or search for custom.</p>}
        </div>
        <footer className="border-t border-black/10 px-5 py-3 text-center text-[11px] text-black/45 sm:px-6">No account connections required · Your links stay in your control</footer>
      </section>
    </div>}
  </>;
}

function ProviderOption({ provider, onClick }: { provider: LinkProvider; onClick: (provider: LinkProvider) => void }) {
  return <button className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-black/10 bg-white px-3 text-left transition hover:border-black/25 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-1" onClick={() => onClick(provider)} type="button">
    <ProviderMark icon={provider.icon} label={provider.name} />
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{provider.name}</span><span className="block truncate text-xs text-black/45">{provider.inputKind === "handle" || provider.inputKind === "username" ? "Username or profile" : provider.inputKind === "email" ? "Email address" : provider.inputKind === "phone" ? "International number" : "Link or URL"}</span></span>
    <span aria-hidden="true" className="text-sm text-black/30">↗</span>
  </button>;
}

export function isLinkProviderId(value: string): value is LinkProviderId {
  return LINK_PROVIDERS.some((provider) => provider.id === value);
}
