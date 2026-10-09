import { Shell } from "./primitives";

const principles = [
  { lead: "The person", rest: "leads.", note: "One identity. Always yours." },
  { lead: "The Mode", rest: "gives context.", note: "Personal, Event, Business." },
  { lead: "Setuvara", rest: "does the rest.", note: "Share, connect, remember." },
];

export function Principle() {
  return (
    <section aria-label="How Setuvara works" className="scroll-mt-16 bg-ink text-paper" id="product">
      <Shell>
        <ol className="grid divide-y divide-paper/15 md:grid-cols-3 md:divide-x md:divide-y-0">
          {principles.map((item, index) => (
            <li className="reveal flex items-baseline gap-4 py-6 md:flex-col md:gap-3 md:px-8 md:py-12 md:first:pl-0 md:last:pr-0" key={item.lead}>
              <span className="w-6 shrink-0 font-label text-[11px] tracking-[0.14em] text-coral">0{index + 1}</span>
              <span className="flex flex-col gap-1.5">
                <span className="font-display text-[26px] font-bold leading-none tracking-[-0.045em] lg:text-[34px]">
                  {item.lead} <span className="text-coral">{item.rest}</span>
                </span>
                <span className="text-[14px] text-paper/55">{item.note}</span>
              </span>
            </li>
          ))}
        </ol>
      </Shell>
    </section>
  );
}
