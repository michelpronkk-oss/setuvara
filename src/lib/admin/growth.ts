/** Labels and the off-site checklist for the admin's Search & AI page. */

export const REFERRER_LABELS: Record<string, string> = {
  direct: "Direct or app", other: "Other sites",
  google: "Google", bing: "Bing", duckduckgo: "DuckDuckGo", yahoo: "Yahoo", ecosia: "Ecosia", yandex: "Yandex", baidu: "Baidu",
  brave: "Brave Search", naver: "Naver", startpage: "Startpage", qwant: "Qwant",
  chatgpt: "ChatGPT", perplexity: "Perplexity", copilot: "Copilot", gemini: "Gemini", claude: "Claude", you: "You.com",
  phind: "Phind", mistral: "Le Chat", meta_ai: "Meta AI", deepseek: "DeepSeek", grok: "Grok",
  x: "X", linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube",
  reddit: "Reddit", threads: "Threads", whatsapp: "WhatsApp", telegram: "Telegram", producthunt: "Product Hunt",
  hackernews: "Hacker News", bluesky: "Bluesky", pinterest: "Pinterest",
};

export const BOT_LABELS: Record<string, { name: string; owner: string }> = {
  googlebot: { name: "Googlebot", owner: "Google Search" },
  bingbot: { name: "Bingbot", owner: "Bing, ChatGPT search, Copilot" },
  applebot: { name: "Applebot", owner: "Siri and Spotlight" },
  duckduckbot: { name: "DuckDuckBot", owner: "DuckDuckGo" },
  yandexbot: { name: "YandexBot", owner: "Yandex" },
  baiduspider: { name: "Baiduspider", owner: "Baidu" },
  seznambot: { name: "SeznamBot", owner: "Seznam" },
  oai_searchbot: { name: "OAI-SearchBot", owner: "ChatGPT search" },
  chatgpt_user: { name: "ChatGPT-User", owner: "ChatGPT, fetching for a user" },
  gptbot: { name: "GPTBot", owner: "OpenAI training" },
  perplexitybot: { name: "PerplexityBot", owner: "Perplexity index" },
  perplexity_user: { name: "Perplexity-User", owner: "Perplexity, fetching for a user" },
  claude_user: { name: "Claude-User", owner: "Claude, fetching for a user" },
  claude_searchbot: { name: "Claude-SearchBot", owner: "Claude search" },
  claudebot: { name: "ClaudeBot", owner: "Anthropic training" },
  mistral_user: { name: "MistralAI-User", owner: "Le Chat" },
  youbot: { name: "YouBot", owner: "You.com" },
  duckassist: { name: "DuckAssistBot", owner: "DuckDuckGo AI answers" },
  applebot_extended: { name: "Applebot-Extended", owner: "Apple AI training" },
  google_extended: { name: "Google-Extended", owner: "Gemini and Google AI" },
  ccbot: { name: "CCBot", owner: "Common Crawl (used by many AI models)" },
  bytespider: { name: "Bytespider", owner: "ByteDance" },
  meta_agent: { name: "Meta-ExternalAgent", owner: "Meta AI" },
  amazonbot: { name: "Amazonbot", owner: "Amazon, Alexa" },
  cohere_ai: { name: "cohere-ai", owner: "Cohere" },
  diffbot: { name: "Diffbot", owner: "Diffbot" },
  ahrefsbot: { name: "AhrefsBot", owner: "Ahrefs (SEO tool)" },
  semrushbot: { name: "SemrushBot", owner: "Semrush (SEO tool)" },
  mj12bot: { name: "MJ12bot", owner: "Majestic (SEO tool)" },
  dotbot: { name: "DotBot", owner: "Moz (SEO tool)" },
};

export const CRAWLER_KIND_LABELS: Record<string, string> = {
  search: "Search", ai_answer: "AI answers", ai_training: "AI training", seo_tool: "SEO tool", other: "Other",
};

export type ChecklistItem = { key: string; label: string; note: string; href?: string };

/** The off-site work that makes search engines and AI tools trust and cite Setuvara. */
export const GROWTH_CHECKLIST: { group: string; items: ChecklistItem[] }[] = [
  {
    group: "Search engines",
    items: [
      { key: "google_search_console", label: "Google Search Console", note: "Verify the domain and submit sitemap.xml.", href: "https://search.google.com/search-console" },
      { key: "bing_webmaster", label: "Bing Webmaster Tools", note: "Verified; submit sitemap.xml. Feeds ChatGPT search and Copilot.", href: "https://www.bing.com/webmasters" },
    ],
  },
  {
    group: "Listings AI tools read",
    items: [
      { key: "product_hunt", label: "Product Hunt launch", note: "A launch page with the one-liner and screenshots.", href: "https://www.producthunt.com" },
      { key: "g2", label: "G2 profile", note: "Category: digital business cards and link in bio.", href: "https://www.g2.com" },
      { key: "capterra", label: "Capterra profile", note: "Same description as the site.", href: "https://www.capterra.com" },
      { key: "alternativeto", label: "AlternativeTo listing", note: "Listed as an alternative to Linktree, Popl and Beacons.", href: "https://alternativeto.net" },
      { key: "crunchbase", label: "Crunchbase", note: "Company profile with the website and founders.", href: "https://www.crunchbase.com" },
      { key: "linkedin_page", label: "LinkedIn company page", note: "Same name, logo and one-liner.", href: "https://www.linkedin.com/company/setup/new/" },
      { key: "wikidata", label: "Wikidata item", note: "Once there is independent press to cite.", href: "https://www.wikidata.org" },
    ],
  },
  {
    group: "Mentions",
    items: [
      { key: "roundup_linkinbio", label: "3 “Linktree alternatives” roundups", note: "Pitch writers of existing lists." },
      { key: "roundup_cards", label: "3 “digital business card app” roundups", note: "Same, for business cards." },
      { key: "community_answers", label: "Helpful answers in communities", note: "Reddit, Indie Hackers, Product Hunt discussions." },
      { key: "first_press", label: "First press article", note: "A launch story or a founder interview." },
    ],
  },
  {
    group: "AI answer checks (monthly)",
    items: [
      { key: "ai_chatgpt", label: "ChatGPT names Setuvara", note: "Ask “best Linktree alternative for meeting people”." },
      { key: "ai_perplexity", label: "Perplexity names Setuvara", note: "Ask “digital business card app with a QR code”." },
      { key: "ai_copilot", label: "Copilot names Setuvara", note: "Ask “event networking app that remembers who you met”." },
      { key: "ai_gemini", label: "Gemini names Setuvara", note: "Ask “what is Setuvara”." },
    ],
  },
];

export const CHECKLIST_KEYS = new Set(GROWTH_CHECKLIST.flatMap((group) => group.items.map((item) => item.key)));
