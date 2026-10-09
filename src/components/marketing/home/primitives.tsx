import type { ReactNode } from "react";

export function Shell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-14 ${className}`}>{children}</div>;
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-label text-[11px] font-medium uppercase tracking-[0.16em] ${className}`}>{children}</p>;
}

/** Marks a capability that is designed but not shipped. Used everywhere future work appears. */
export function LaterTag({ children = "Later", className = "" }: { children?: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full border border-current/40 px-2 py-0.5 font-label text-[10px] font-medium uppercase leading-4 tracking-[0.14em] ${className}`}>{children}</span>;
}

export function Display({ as: Tag = "h2", children, className = "" }: { as?: "h1" | "h2" | "h3" | "p"; children: ReactNode; className?: string }) {
  return <Tag className={`font-display font-extrabold tracking-[-0.055em] text-balance ${className}`}>{children}</Tag>;
}

export function ClaimForm({ tone = "light", id }: { tone?: "light" | "coral"; id: string }) {
  return (
    <form action="/signup" className={`flex h-[60px] w-full max-w-[520px] items-center gap-1 rounded-full pl-5 pr-1.5 shadow-[inset_0_0_0_1.5px_#0d0d0d] focus-within:shadow-[inset_0_0_0_2.5px_#0d0d0d] ${tone === "coral" ? "bg-paper" : "bg-white"}`} method="get">
      <label className="sr-only" htmlFor={id}>Choose your Setuvara username</label>
      <span aria-hidden="true" className="shrink-0 font-label text-[15px] text-ink/55 sm:text-[16px]">setuvara.com/</span>
      <input
        autoCapitalize="none"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent font-label text-[16px] font-medium text-ink outline-none placeholder:text-ink/35 sm:text-[15px]"
        id={id}
        maxLength={24}
        name="username"
        pattern="[A-Za-z0-9_]{3,24}"
        placeholder="yourname"
        spellCheck={false}
        title="3–24 letters, numbers, or underscores"
      />
      <button className="h-12 shrink-0 rounded-full bg-ink px-5 text-[15px] font-semibold text-paper transition-colors hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" type="submit">Claim</button>
    </form>
  );
}

export type DemoLink = { provider: string; title: string; detail: string };
