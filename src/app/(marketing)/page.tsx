import { MarketingAction, MarketingContainer, MarketingEyebrow } from "@/components/marketing/primitives";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "One identity. Every version of you.",
  description: "Setuvara brings your identity and real-world connections together, with the freedom to share the context that fits the moment.",
  path: "/",
});

const modes = [
  { number: "01", name: "Personal", description: "The parts of you that travel beyond a title or a meeting." },
  { number: "02", name: "Event", description: "The context you want to bring into a particular room." },
  { number: "03", name: "Business", description: "The work, people, and ideas you want to connect through." },
];

export default function HomePage() {
  return (
    <>
      <section className="py-20 sm:py-28 lg:py-36">
        <MarketingContainer>
          <div className="max-w-5xl">
            <MarketingEyebrow>A digital identity for real life</MarketingEyebrow>
            <h1 className="mt-7 max-w-5xl text-6xl font-semibold leading-[0.98] tracking-[-0.065em] sm:text-8xl lg:text-[108px]">
              One identity.<br />Every version of you.
            </h1>
            <div className="mt-8 flex flex-col gap-7 sm:mt-10 sm:flex-row sm:items-end sm:justify-between">
              <p className="max-w-xl text-lg leading-8 text-[#0d0d0d]/70 sm:text-xl sm:leading-9">
                Meet people as yourself. Share the context that fits the moment, and keep the connection going.
              </p>
              <div className="flex shrink-0 flex-wrap gap-3">
                <MarketingAction href="/signup">Create your identity</MarketingAction>
                <MarketingAction href="#product" secondary>Discover Setuvara</MarketingAction>
              </div>
            </div>
          </div>
        </MarketingContainer>
      </section>

      <section className="border-y border-[#0d0d0d]/10 py-16 sm:py-24" id="product">
        <MarketingContainer>
          <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
            <MarketingEyebrow>The idea</MarketingEyebrow>
            <div className="max-w-3xl">
              <h2 className="text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">Your identity is yours. The context is yours to choose.</h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#0d0d0d]/70 sm:text-lg sm:leading-8">
                Setuvara brings one identity into the moments where people meet. Create Personal, Event, and Business Modes, then share the version that feels right for the conversation.
              </p>
            </div>
          </div>
        </MarketingContainer>
      </section>

      <section className="py-16 sm:py-24" id="modes">
        <MarketingContainer>
          <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
            <div>
              <MarketingEyebrow>One person, different moments</MarketingEyebrow>
              <h2 className="mt-4 max-w-sm text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">The person leads. The Mode provides context.</h2>
            </div>
            <ol className="divide-y divide-[#0d0d0d]/15 border-y border-[#0d0d0d]/15">
              {modes.map((mode) => (
                <li className="grid gap-2 py-5 sm:grid-cols-[3rem_10rem_1fr] sm:items-baseline sm:gap-4" key={mode.name}>
                  <span className="text-xs font-semibold tabular-nums text-[#0d0d0d]/45">{mode.number}</span>
                  <h3 className="text-xl font-semibold tracking-tight">{mode.name}</h3>
                  <p className="max-w-lg text-sm leading-6 text-[#0d0d0d]/65 sm:text-base">{mode.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </MarketingContainer>
      </section>

      <section className="bg-[#0d0d0d] py-16 text-[#f5f4ef] sm:py-24">
        <MarketingContainer>
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <MarketingEyebrow>Make the next introduction yours</MarketingEyebrow>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">A good connection starts with showing up as yourself.</h2>
            </div>
            <MarketingAction href="/signup">Get started</MarketingAction>
          </div>
        </MarketingContainer>
      </section>
    </>
  );
}
