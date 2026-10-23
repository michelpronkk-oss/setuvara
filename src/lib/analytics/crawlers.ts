import { sectionForPath } from "./site-pages";

/**
 * Known search and AI crawlers by user agent, counted per day and site section for the admin's
 * Search & AI view. Order matters: the more specific agent comes first (ChatGPT-User before GPTBot).
 */
const BOTS: [RegExp, string][] = [
  [/OAI-SearchBot/i, "oai_searchbot"],
  [/ChatGPT-User/i, "chatgpt_user"],
  [/GPTBot/i, "gptbot"],
  [/Perplexity-User/i, "perplexity_user"],
  [/PerplexityBot/i, "perplexitybot"],
  [/Claude-User/i, "claude_user"],
  [/Claude-SearchBot/i, "claude_searchbot"],
  [/ClaudeBot|anthropic-ai/i, "claudebot"],
  [/MistralAI-User/i, "mistral_user"],
  [/YouBot/i, "youbot"],
  [/DuckAssistBot/i, "duckassist"],
  [/Applebot-Extended/i, "applebot_extended"],
  [/Applebot/i, "applebot"],
  [/Google-Extended|GoogleOther|Google-CloudVertexBot/i, "google_extended"],
  [/Googlebot|Google-InspectionTool|Storebot-Google/i, "googlebot"],
  [/bingbot|BingPreview|msnbot/i, "bingbot"],
  [/DuckDuckBot/i, "duckduckbot"],
  [/YandexBot/i, "yandexbot"],
  [/Baiduspider/i, "baiduspider"],
  [/SeznamBot/i, "seznambot"],
  [/CCBot/i, "ccbot"],
  [/Bytespider/i, "bytespider"],
  [/meta-externalagent|meta-externalfetcher|FacebookBot/i, "meta_agent"],
  [/Amazonbot/i, "amazonbot"],
  [/cohere-ai|cohere-training/i, "cohere_ai"],
  [/Diffbot/i, "diffbot"],
  [/AhrefsBot/i, "ahrefsbot"],
  [/SemrushBot/i, "semrushbot"],
  [/MJ12bot/i, "mj12bot"],
  [/DotBot/i, "dotbot"],
];

export function crawlerFor(userAgent: string | null): string | null {
  if (!userAgent) return null;
  return BOTS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
}

/** The section a crawler request belongs to: the machine-readable files, a marketing section, or a member page. */
export function crawlerSection(pathname: string): string | null {
  if (pathname === "/llms.txt" || pathname === "/llms-full.txt") return "llms";
  if (pathname.startsWith("/sitemap")) return "sitemap";
  if (pathname === "/robots.txt") return "robots";
  if (pathname.startsWith("/api/") || pathname.startsWith("/app") || pathname.startsWith("/auth") || pathname.startsWith("/_next")) return null;
  const section = sectionForPath(pathname);
  if (section) return section;
  // One plain segment (or a handle's Mode page) is a member page.
  return /^\/[A-Za-z0-9_]{3,24}(\/[a-z]+)?\/?$/.test(pathname) ? "profile" : "other";
}

/** Adds one hit to today's counter. Runs after the response is sent; failures are ignored. */
export async function recordCrawlerVisit(bot: string, section: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/rpc/record_crawler_visit`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_bot: bot, p_section: section }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // Counting is best-effort; the crawler's request is unaffected.
  }
}
