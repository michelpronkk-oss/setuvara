import { MarketingContainer, MarketingEyebrow } from "@/components/marketing/primitives";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Roadmap | Setuvara",
  description: "See what is live, what is next, and what Setuvara is exploring as we make it easier to meet, share and stay connected.",
  path: "/roadmap",
});

const stages = [
  {
    label: "Live",
    note: "Here today",
    tone: "text-[#c7ff4a]",
    items: [
      { title: "Identity", description: "One identity built around you." },
      { title: "Personal, Event & Business", description: "Show the right version of yourself for the moment." },
      { title: "Quick QR", description: "One QR that follows what you have Equipped." },
      { title: "Setuvara Tap", description: "A dynamic tap experience powered by your Equipped identity." },
      { title: "Connections", description: "Meet once and keep the relationship." },
      { title: "Passport", description: "See your network and milestones grow." },
      { title: "Analytics", description: "Understand what happens after you share." },
    ],
  },
  {
    label: "Next",
    note: "In progress",
    tone: "text-[#afcbff]",
    items: [
      { title: "Apple & Google Wallet", description: "Carry your Setuvara identity with you. Your Wallet pass will follow what you have Equipped automatically." },
      { title: "Product refinement", description: "Making every part of sharing, connecting and remembering feel faster and more effortless." },
      { title: "Identity expression", description: "More ways to make your Setuvara identity feel like yours." },
    ],
  },
  {
    label: "Later",
    note: "Exploring",
    tone: "text-white/45",
    items: [
      { title: "Physical Setuvara", description: "A physical way to tap or scan your Setuvara identity." },
    ],
  },
] as const;

export default function RoadmapPage() {
  return (
    <>
      <section className="relative overflow-hidden py-20 sm:py-28 lg:py-36">
        <MarketingContainer>
          <div className="max-w-5xl">
            <MarketingEyebrow>Setuvara roadmap</MarketingEyebrow>
            <h1 className="mt-6 max-w-5xl text-balance font-display text-[clamp(46px,7vw,104px)] font-extrabold leading-[0.88] tracking-[-0.06em]">Built around the moments that matter.</h1>
            <p className="mt-8 max-w-2xl text-[18px] leading-[1.55] text-ink/70 sm:text-[21px]">Built in the open. Focused on what makes meeting, sharing and staying connected better.</p>
          </div>
        </MarketingContainer>
      </section>

      <section aria-label="Setuvara product roadmap" className="bg-ink py-14 text-paper sm:py-20 lg:py-24">
        <MarketingContainer className="grid gap-4 md:grid-cols-3 md:gap-5">
          {stages.map((stage) => (
            <section aria-labelledby={`roadmap-${stage.label.toLowerCase()}`} className="flex min-w-0 flex-col rounded-[24px] border border-white/12 bg-white/[0.035] p-5 sm:p-7" key={stage.label}>
              <div className="flex items-baseline justify-between gap-4 border-b border-white/12 pb-4">
                <h2 className={`font-label text-[12px] font-semibold uppercase tracking-[0.2em] ${stage.tone}`} id={`roadmap-${stage.label.toLowerCase()}`}>{stage.label}</h2>
                <p className="text-xs text-white/45">{stage.note}</p>
              </div>
              <ul className="mt-2">
                {stage.items.map((item) => (
                  <li className="border-b border-white/10 py-5 last:border-b-0" key={item.title}>
                    <h3 className="font-display text-lg font-semibold tracking-[-0.025em] sm:text-xl">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/65">{item.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </MarketingContainer>
      </section>
    </>
  );
}
