import Link from "next/link";
import type { ReactNode } from "react";

import { nameFontClasses } from "@/components/profile/name-fonts";
import { JsonLd } from "@/components/seo/json-ld";
import { BLOG_POSTS, type BlogBlock, type BlogPost } from "@/lib/marketing/blog-content";
import { SETUVARA_ORGANIZATION_ID, SETUVARA_ORIGIN } from "@/lib/marketing/metadata";
import { MODE_PAGES } from "@/lib/marketing/modes-content";

import { CastPhone } from "../home/mode-phone";
import { Label } from "../home/primitives";
import { ArticleLayout, ArticleStage, articleDate, KeepReading, proseH2, proseP } from "./article";
import { CtaBand, PageHero, Section, Stage } from "./kit";

type ModeSlug = "personal" | "event" | "business" | "creator";

/** Which Mode's stage a post stands on, by its topic. */
const TOPIC_MODE: Record<string, ModeSlug> = { Events: "event", Founders: "business", Creators: "creator" };
const modeFor = (post: BlogPost): ModeSlug => TOPIC_MODE[post.topic] ?? "personal";

const anchor = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Turns [text](/path) into internal links; everything else stays text. */
function inline(text: string): ReactNode[] {
  return text.split(/(\[[^\]]+\]\(\/[^)\s]*\))/g).map((part, index) => {
    const match = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/.exec(part);
    return match ? <Link className="font-semibold text-ink underline decoration-coral decoration-2 underline-offset-4 hover:text-coral" href={match[2]} key={index}>{match[1]}</Link> : part;
  });
}

function Block({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case "h2": return <h2 className={proseH2} id={anchor(block.text)}>{block.text}</h2>;
    case "list": return <ul className="mt-6 flex flex-col gap-3">{block.items.map((item) => <li className="flex gap-4 text-[17px] leading-[1.7] text-ink/80 sm:text-[18px]" key={item}><span aria-hidden="true" className="mt-[12px] size-1.5 shrink-0 rounded-full bg-coral" />{inline(item)}</li>)}</ul>;
    case "tip": return <p className="mt-8 rounded-[20px] bg-white p-6 text-[16px] leading-[1.65] shadow-[0_30px_60px_-50px_rgba(13,13,13,.45)]">{inline(block.text)}</p>;
    default: return <p className={proseP}>{inline(block.text)}</p>;
  }
}

export function BlogIndex() {
  return (
    <>
      <PageHero crumbs={[{ name: "Blog", path: "/blog" }]} eyebrow="Blog" lede="Meeting people, sharing your work and building in public. Two posts a month." title="Blog." />
      <Section id="posts" tone="paper" className="!pt-0 [&>div]:!pt-0">
        <ul className={`${nameFontClasses} grid gap-8 md:grid-cols-2`}>
          {BLOG_POSTS.map((post) => (
            <li className="group relative" key={post.slug}>
              <Stage className="h-[300px]" slug={modeFor(post)}>
                <div aria-hidden="true" className="absolute left-1/2 top-[12%] origin-top -translate-x-1/2 scale-[.74] transition-transform duration-500 group-hover:-translate-y-2" inert><CastPhone slug={modeFor(post)} /></div>
              </Stage>
              <Label className="mt-6 text-coral">{post.topic} · <time dateTime={post.published}>{articleDate(post.published)}</time> · {post.readingMinutes} min</Label>
              <Link className="mt-3 block font-display text-[clamp(28px,2.6vw,36px)] font-extrabold leading-[0.98] tracking-[-0.05em] after:absolute after:inset-0 after:rounded-[28px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-coral" href={`/blog/${post.slug}`}>{post.title}</Link>
              <p className="mt-3 text-[16px] leading-[1.6] text-ink/62">{post.description}</p>
            </li>
          ))}
        </ul>
      </Section>
      <CtaBand claimId="blog-cta" secondary={{ href: "/what-is-setuvara", label: "What is Setuvara?" }} title="Meet once. Stay connected." />
    </>
  );
}

export function BlogArticle({ post }: { post: BlogPost }) {
  const url = `${SETUVARA_ORIGIN}/blog/${post.slug}`;
  const mode = modeFor(post);
  const toc = post.blocks.flatMap((block) => (block.type === "h2" ? [{ id: anchor(block.text), label: block.text.replace(/:.*$/, "") }] : []));
  const others = BLOG_POSTS.filter((other) => other.slug !== post.slug);
  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        url,
        mainEntityOfPage: url,
        datePublished: post.published,
        dateModified: post.updated ?? post.published,
        author: { "@type": "Organization", "@id": SETUVARA_ORGANIZATION_ID, name: "Setuvara" },
        publisher: { "@id": SETUVARA_ORGANIZATION_ID },
        image: `${SETUVARA_ORIGIN}/share/setuvara-marketing.png`,
      }} />
      <ArticleLayout
        aside={{ title: `Your ${MODE_PAGES[mode].name} page, free.`, cta: "Claim your name", href: "/signup" }}
        crumbs={[{ name: "Blog", path: "/blog" }, { name: post.title, path: `/blog/${post.slug}` }]}
        date={post.published}
        hero={<ArticleStage slug={mode} url={MODE_PAGES[mode].share} />}
        kicker={post.topic}
        lede={post.description}
        minutes={post.readingMinutes}
        title={post.title}
        toc={toc}
      >
        {post.blocks.map((block, index) => <Block block={block} key={index} />)}
      </ArticleLayout>
      {others.length ? <KeepReading all={{ href: "/blog", label: "All posts" }} items={[...others.map((other) => ({ href: `/blog/${other.slug}`, kicker: other.topic, title: other.title, slug: modeFor(other) })), ...post.related.slice(0, Math.max(0, 3 - others.length)).map((link) => ({ href: link.href, kicker: "Read next", title: link.label, slug: mode }))]} /> : null}
      <CtaBand claimId={`blog-${post.slug}-cta`} secondary={{ href: "/what-is-setuvara", label: "What is Setuvara?" }} title="Make your page." />
    </>
  );
}
