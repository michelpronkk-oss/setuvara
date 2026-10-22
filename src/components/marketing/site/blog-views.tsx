import Link from "next/link";
import type { ReactNode } from "react";

import { JsonLd } from "@/components/seo/json-ld";
import { BLOG_POSTS, type BlogBlock, type BlogPost } from "@/lib/marketing/blog-content";
import { SETUVARA_ORGANIZATION_ID, SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

import { Breadcrumbs, CtaBand, RelatedLinks } from "./kit";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dated = (iso: string) => DATE.format(new Date(`${iso}T00:00:00Z`));

/** Turns [text](/path) into internal links; everything else stays text. */
function inline(text: string): ReactNode[] {
  return text.split(/(\[[^\]]+\]\(\/[^)\s]*\))/g).map((part, index) => {
    const match = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/.exec(part);
    return match ? <Link className="font-semibold underline decoration-coral decoration-2 underline-offset-4 hover:text-coral" href={match[2]} key={index}>{match[1]}</Link> : part;
  });
}

function Block({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case "h2": return <h2 className="mt-12 font-display text-[clamp(26px,3vw,34px)] font-bold leading-tight tracking-[-0.04em]">{block.text}</h2>;
    case "list": return <ul className="mt-5 flex flex-col gap-2.5">{block.items.map((item) => <li className="flex gap-3 text-[18px] leading-[1.6]" key={item}><span aria-hidden="true" className="mt-[11px] size-1.5 shrink-0 rounded-full bg-coral" />{inline(item)}</li>)}</ul>;
    case "tip": return <p className="mt-6 rounded-[20px] bg-white p-5 text-[17px] leading-[1.6] shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">{inline(block.text)}</p>;
    default: return <p className="mt-5 text-[18px] leading-[1.7] text-ink/80">{inline(block.text)}</p>;
  }
}

export function BlogIndex() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 pb-20 pt-10 sm:px-8 sm:pt-16 lg:px-14">
      <Breadcrumbs trail={[{ name: "Blog", path: "/blog" }]} />
      <h1 className="mt-6 font-display text-[clamp(48px,7vw,104px)] font-extrabold leading-[0.9] tracking-[-0.055em]">Blog.</h1>
      <p className="mt-5 max-w-[34rem] text-[19px] leading-[1.5] text-ink/65">Meeting people, sharing your work and building in public. Two posts a month.</p>
      <ul className="mt-12 grid gap-5 md:grid-cols-2">
        {BLOG_POSTS.map((post) => (
          <li key={post.slug}>
            <Link className="group flex h-full flex-col rounded-[28px] bg-white p-7 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition-shadow hover:shadow-[inset_0_0_0_1.5px_#0D0D0D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral sm:p-9" href={`/blog/${post.slug}`}>
              <span className="font-label text-[11px] uppercase tracking-[0.16em] text-coral">{post.topic}</span>
              <span className="mt-4 font-display text-[clamp(24px,2.4vw,32px)] font-bold leading-[1.1] tracking-[-0.04em]">{post.title}</span>
              <span className="mt-3 text-[16px] leading-[1.55] text-ink/65">{post.description}</span>
              <span className="mt-auto pt-6 text-[14px] text-ink/50"><time dateTime={post.published}>{dated(post.published)}</time> · {post.readingMinutes} min read</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BlogArticle({ post }: { post: BlogPost }) {
  const url = `${SETUVARA_ORIGIN}/blog/${post.slug}`;
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
      <article className="mx-auto w-full max-w-[1440px] px-5 pb-16 pt-10 sm:px-8 sm:pt-16 lg:px-14">
        <Breadcrumbs trail={[{ name: "Blog", path: "/blog" }, { name: post.title, path: `/blog/${post.slug}` }]} />
        <div className="mx-auto max-w-[720px]">
          <p className="mt-8 font-label text-[11px] uppercase tracking-[0.16em] text-coral">{post.topic}</p>
          <h1 className="mt-4 font-display text-[clamp(36px,5vw,64px)] font-extrabold leading-[0.98] tracking-[-0.05em] text-balance">{post.title}</h1>
          <p className="mt-5 text-[15px] text-ink/55">By Setuvara · <time dateTime={post.published}>{dated(post.published)}</time> · {post.readingMinutes} min read</p>
          <p className="mt-8 border-t border-ink/10 pt-8 text-[21px] leading-[1.55] text-ink/85">{post.description}</p>
          {post.blocks.map((block, index) => <Block block={block} key={index} />)}
        </div>
      </article>
      <RelatedLinks items={post.related} title="Read next" />
      <CtaBand claimId={`blog-${post.slug}-cta`} line="Free to start, with all four Modes." secondary={{ href: "/what-is-setuvara", label: "What is Setuvara?" }} title="Make your page." />
    </>
  );
}
