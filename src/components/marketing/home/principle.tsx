import Link from "next/link";

import { Label, Shell } from "./primitives";

const loop = [
  { step: "Identity", href: "#modes" },
  { step: "Mode", href: "#modes" },
  { step: "Share", href: "#share" },
  { step: "Connect", href: "#how" },
  { step: "Context", href: "#remember" },
  { step: "Remember", href: "#connections" },
  { step: "Passport", href: "#passport" },
];

export function Principle() {
  return (
    <section aria-labelledby="principle-title" className="scroll-mt-16 border-t border-ink/10" id="product">
      <Shell className="flex flex-col gap-6 py-14 sm:gap-10 sm:py-24 lg:gap-14 lg:py-28">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-12">
          <Label className="text-ink/55">How Setuvara works</Label>
          <p className="hidden max-w-md text-[17px] leading-7 text-ink/70 md:block">Not a link page. Not a business card. An identity for real life — and a network that remembers how you met.</p>
        </div>
        <div>
          <h2 className="font-display text-[clamp(36px,5.9vw,88px)] font-extrabold leading-[0.95] tracking-[-0.055em]" id="principle-title">
            <span className="reveal block">The person leads.</span>
            <span className="reveal block text-ink/40">The Mode provides context.</span>
            <span className="reveal block text-ink/40">Setuvara provides the&nbsp;system.</span>
          </h2>
          <ol aria-label="The Setuvara loop" className="mt-10 hidden flex-wrap items-center gap-x-2 gap-y-3 font-label sm:flex text-[12px] uppercase tracking-[0.12em] sm:mt-14">
            {loop.map((item, index) => (
              <li className="flex items-center gap-2" key={item.step}>
                <Link className="inline-flex min-h-9 items-center gap-2 rounded-full border border-ink/20 px-3 transition-colors hover:border-ink hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-coral" href={item.href}>
                  <span className="text-coral">{String(index + 1).padStart(2, "0")}</span>{item.step}
                </Link>
                <span aria-hidden="true" className="text-ink/35">→</span>
              </li>
            ))}
            <li><span className="inline-flex min-h-9 items-center rounded-full bg-ink px-3 text-paper">Share again ↺</span></li>
          </ol>
        </div>
      </Shell>
    </section>
  );
}
