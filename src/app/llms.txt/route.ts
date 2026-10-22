import { BLOG_POSTS } from "@/lib/marketing/blog-content";
import { COMPARE_ORDER, COMPARE_PAGES } from "@/lib/marketing/compare-content";
import { CATEGORY_LINE, COMING, EVERY_PLAN, LOOKS, MODES, NOT_THIS, ONE_LINER, PLAN_LIMITS, PRICE_LINE } from "@/lib/marketing/facts";
import { FEATURE_ORDER, FEATURE_PAGES } from "@/lib/marketing/features-content";
import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";
import { TOOLS } from "@/lib/marketing/tools";
import { USE_CASE_ORDER, USE_CASES } from "@/lib/marketing/use-cases-content";

export const dynamic = "force-static";

/**
 * /llms.txt (llmstxt.org): Setuvara in plain Markdown for AI assistants. Built from facts.ts and
 * the page content modules, so it always says what the site says.
 */
export function GET() {
  const link = (path: string, title: string, line: string) => `- [${title}](${SETUVARA_ORIGIN}${path}): ${line}`;
  const body = [
    "# Setuvara",
    "",
    `> ${ONE_LINER}`,
    "",
    `${CATEGORY_LINE} ${PRICE_LINE}`,
    "",
    "## Key facts",
    "",
    ...MODES.map((mode) => `- ${mode.name} Mode: ${mode.line}`),
    `- Looks: ${LOOKS.total} (${LOOKS.all.join(", ")}); ${LOOKS.free.join(" and ")} are free.`,
    "- Sharing: link, QR code, Quick QR and Setuvara Tap (any NFC card, ring or sticker). Event, Business and Creator Modes share on private /s/ links without the username.",
    "- Visitors open pages in any browser and connect in one tap without an account.",
    ...EVERY_PLAN.map((item) => `- On every plan: ${item}.`),
    ...NOT_THIS.map((line) => `- ${line}`),
    `- In development, not live: ${COMING.join(", ")}.`,
    "",
    "## Plans (Free / Plus / Pro)",
    "",
    ...PLAN_LIMITS.flatMap((group) => [`### ${group.group}`, ...group.rows.map((row) => `- ${row.label}: ${row.free} / ${row.plus} / ${row.pro}`), ""]),
    "## Pages",
    "",
    link("/what-is-setuvara", "What is Setuvara", "plain-language overview"),
    link("/pricing", "Pricing", "Free, Plus and Pro compared line by line"),
    link("/modes", "Modes", "the four Modes side by side"),
    ...MODES.map((mode) => link(`/${mode.slug}`, `${mode.name} Mode`, mode.line)),
    ...FEATURE_ORDER.map((slug) => link(`/features/${slug}`, FEATURE_PAGES[slug].name, FEATURE_PAGES[slug].lede)),
    link("/gallery", "Gallery", "real member pages, listed by choice"),
    link("/templates", "Templates", "every Look and Mode"),
    "",
    "## Use cases",
    "",
    ...USE_CASE_ORDER.map((slug) => link(`/use-cases/${slug}`, USE_CASES[slug].name, USE_CASES[slug].metaDescription)),
    "",
    "## Comparisons",
    "",
    ...COMPARE_ORDER.map((slug) => link(`/compare/${slug}`, COMPARE_PAGES[slug].title, COMPARE_PAGES[slug].summary.them)),
    "",
    "## Free tools",
    "",
    ...TOOLS.map((tool) => link(tool.path, tool.name, tool.line)),
    "",
    "## Blog",
    "",
    ...BLOG_POSTS.map((post) => link(`/blog/${post.slug}`, post.title, post.description)),
    "",
    "## Optional",
    "",
    link("/privacy", "Privacy", "how Setuvara handles data"),
    link("/terms", "Terms", "terms of service"),
    link("/contact", "Contact", "hello@setuvara.com"),
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
