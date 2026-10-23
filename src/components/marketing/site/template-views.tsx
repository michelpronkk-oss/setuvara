import Link from "next/link";

import { nameFontClasses } from "@/components/profile/name-fonts";
import type { AppearanceId } from "@/components/profile/types";
import { JsonLd } from "@/components/seo/json-ld";
import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";
import { MODE_PAGES } from "@/lib/marketing/modes-content";
import { LOOK_TEMPLATES, MODE_TEMPLATES, type LookTemplate, type ModeTemplate } from "@/lib/marketing/templates-content";

import { CAST, ModeDesktop, ModePhone } from "../home/mode-phone";
import { BrowserFrame, ButtonLink, CtaBand, PageHero, RelatedLinks, Section, Stage } from "./kit";

type ModeSlug = keyof typeof MODE_PAGES;

/** The Look with the pictures it draws with, or the cast's own styling when it already wears it. */
function lookFor(mode: ModeSlug, id: AppearanceId) {
  const pictures = LOOK_TEMPLATES.find((t) => t.slug === id)?.pictures;
  if (pictures) return { theme: id, pictures };
  const cast = CAST[mode];
  return cast.look.theme === id ? cast.look : { theme: id };
}

/** The phone standing on its Mode's stage, cropped at the bottom like the gallery cards. */
function StagePhone({ mode, who, look, className = "h-[420px] lg:h-[460px]", scale = "scale-[.7]" }: { mode: ModeSlug; who: LookTemplate["who"]; look: AppearanceId; className?: string; scale?: string }) {
  return (
    <Stage className={className} slug={mode}>
      <div aria-hidden="true" className={`absolute left-1/2 top-[7%] origin-top -translate-x-1/2 transition-transform duration-500 group-hover:-translate-y-2 ${scale}`} inert>
        <div className="rounded-[46px] shadow-[0_40px_60px_-30px_rgba(13,13,13,.6)]"><ModePhone look={lookFor(mode, look)} slug={mode} who={who} /></div>
      </div>
    </Stage>
  );
}

/** The card's title link, stretched over the whole card; the preview inside is inert, so its own links never nest in this one. */
const stretched = "truncate text-[16px] font-semibold after:absolute after:inset-0 after:rounded-[28px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-coral";

/** /templates: every Look, then every Mode. */
export function TemplatesIndex() {
  return (
    <>
      <PageHero crumbs={[{ name: "Templates", path: "/templates" }]} eyebrow="Templates" lede="Ten Looks, each with its own phone and desktop composition, and four Modes to wear them in. Pick one and make it yours in minutes." title="Templates." />
      <Section eyebrow="By Look" id="looks" lede="Immersive and Clean are free. All ten are on Plus and Pro." title="Ten Looks." tone="white">
        <ul className={`${nameFontClasses} grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`}>
          {LOOK_TEMPLATES.map((template) => (
            <li className="group relative" key={template.slug}>
              <StagePhone className="h-[400px] xl:h-[380px]" look={template.slug} mode={template.mode} scale="scale-[.68] xl:scale-[.6]" who={template.who} />
              <p className="mt-4 flex items-baseline justify-between gap-3"><Link className={stretched} href={`/templates/${template.slug}`}>{template.name}</Link><span className={`shrink-0 font-label text-[10px] uppercase tracking-[0.16em] ${template.free ? "text-ink/50" : "text-coral"}`}>{template.free ? "Free" : "Plus"}</span></p>
              <p className="mt-1 text-[14px] leading-[1.5] text-ink/60">{template.line}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section eyebrow="By Mode" id="modes" lede="Every Mode can wear any Look. These are starting points." title="Four Modes.">
        <ul className={`${nameFontClasses} grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-4`}>
          {MODE_TEMPLATES.map((template) => (
            <li className="group relative" key={template.slug}>
              <StagePhone look={template.look} mode={template.mode} who={CAST[template.mode].who} />
              <p className="mt-4 flex items-baseline justify-between gap-3"><Link className={stretched} href={`/templates/${template.slug}`}>{template.name}</Link><span className="shrink-0 font-label text-[10px] uppercase tracking-[0.16em] text-ink/50">{MODE_PAGES[template.mode].name} Mode</span></p>
              <p className="mt-1 text-[14px] leading-[1.5] text-ink/60">{template.line}</p>
            </li>
          ))}
        </ul>
      </Section>
      <CtaBand claimId="templates-cta" line="Free to start. Change the Look any time; nothing you add is lost." secondary={{ href: "/gallery", label: "See real pages" }} title="Pick one. Make it yours." />
    </>
  );
}

/** One template: the desktop and phone views, what it's good for, and a way to start with it. */
export function TemplatePage({ template }: { template: LookTemplate | ModeTemplate }) {
  const path = `/templates/${template.slug}`;
  const mode = template.mode;
  const look = template.kind === "look" ? template.slug : template.look;
  const who = template.kind === "look" ? template.who : CAST[mode].who;
  const start = template.kind === "look" ? `/signup?appearance=${template.slug}` : "/signup";
  const others = template.kind === "look"
    ? LOOK_TEMPLATES.filter((t) => t.slug !== template.slug).slice(0, 3).map((t) => ({ href: `/templates/${t.slug}`, label: `${t.name} template`, line: t.line }))
    : MODE_TEMPLATES.filter((t) => t.slug !== template.slug).map((t) => ({ href: `/templates/${t.slug}`, label: `${t.name} template`, line: t.line }));
  const title = template.kind === "look" ? `${template.name} template` : `${template.name} template`;
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: `${title} for Setuvara`, url: `${SETUVARA_ORIGIN}${path}`, description: template.line }} />
      <PageHero
        actions={<div className="flex flex-wrap gap-3"><ButtonLink href={start}>Use this template</ButtonLink><ButtonLink href={MODE_PAGES[mode].path} tone="outline">About {MODE_PAGES[mode].name} Mode</ButtonLink></div>}
        crumbs={[{ name: "Templates", path: "/templates" }, { name: template.name, path }]}
        eyebrow={template.kind === "look" ? (template.free ? "Look · Free" : "Look · Plus and Pro") : "Mode template"}
        lede={template.kind === "look" ? `${template.line} ${template.bestFor}` : `${template.line} Shown here in the ${look[0].toUpperCase()}${look.slice(1)} Look; every Mode can wear any of the ten.`}
        title={title}
        visual={<div className={nameFontClasses}><StagePhone className="h-[520px] sm:h-[600px]" look={look} mode={mode} scale="scale-[.82] sm:scale-[.92]" who={who} /></div>}
      />
      <Section eyebrow="On a laptop" id="desktop" lede="Every Look has its own desktop composition, so your page is a full spread, not a phone in the middle of the screen." title="The desktop view." tone="white">
        {/* Capped at the widest drawing (1280 × 0.9 plus the frame) so it never leaves an empty strip. */}
        <div className={`${nameFontClasses} mx-auto max-w-[1168px]`}>
          <BrowserFrame url={`setuvara.com/${who.username}`}>
            <ModeDesktop look={lookFor(mode, look)} scales="[--z:.26] sm:[--z:.44] md:[--z:.52] lg:[--z:.7] xl:[--z:.9]" slug={mode} who={who} />
          </BrowserFrame>
        </div>
      </Section>
      {template.kind === "look" && (
        <Section eyebrow="Details" id="details" title={`What makes ${template.name}.`}>
          <ul className="grid gap-4 md:grid-cols-3">{template.details.map((detail) => <li className="border-t-[1.5px] border-ink pt-6 text-[19px] leading-[1.45]" key={detail}>{detail}</li>)}</ul>
        </Section>
      )}
      <RelatedLinks items={others} title="More templates" />
      <CtaBand claimId={`template-${template.slug}-cta`} line={template.kind === "look" && !template.free ? "Free to start; this Look is on Plus and Pro. Your content stays if you switch." : "Free to start. Change the Look any time; nothing you add is lost."} secondary={{ href: "/templates", label: "All templates" }} title="Start with your name." />
    </>
  );
}
