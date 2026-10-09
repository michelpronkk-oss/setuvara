import { contentForAuth, contentForNotification, EMAIL_MILESTONES, renderEmail, type EmailContent, type EmailTemplateKey } from "./email.tsx";
import { MILESTONES, PASSPORT_REWARDS } from "../../../src/lib/passport/rewards.ts";

const site = "https://setuvara.com";
const footer = { unsubscribeUrl: `${site}/api/email/unsubscribe?token=preview-only-token`, preferencesUrl: `${site}/app/settings/notifications` };
const authTemplates = ["signup", "invite", "magiclink", "recovery", "email_change", "reauthentication", "account_notice"] as const;
const notificationTemplates = ["welcome", "new_connection", "connection_recap", "guest_claimed", "passport_milestone", "passport_stamp", "creator_application", "creator_approved", "creator_collaboration", "business_action"] as const;
const richDetails = [
  ["name", "Marco Silva"], ["event", "Slush"], ["city", "Helsinki"], ["date", "09 Oct 2026"], ["role", "Head of Sales"], ["company", "Northlight"],
  ["count", "12"], ["dates", "08–09 Oct 2026"], ["person 1", "Marco Silva"], ["person 2", "Noah Chen"], ["more", "+10"],
  ["milestone", "50 Connections"], ["unlocked", "2026-10-09"], ["stamp", "Amsterdam"], ["stamp_subtitle", "Netherlands"], ["stamp_type", "city"], ["stamp_date", "2026-10-09"],
  ["username", "setuvara.com/aanya"], ["handle", "meyvor"], ["brand", "Northwind Audio"], ["budget", "€2,000–€3,500"], ["action", "Lena|left a review|2 hours ago"],
].map(([label, value]) => ({ label, value }));

function allContent(): [string, EmailContent][] {
  return [
    ...authTemplates.map((template) => [template, contentForAuth({ template, url: `${site}/auth/confirm?next=%2Fapp%2Fidentity&token_hash=preview-only&type=email`, code: "123456", handle: "aanya", email: "aanya@example.test" })] as [string, EmailContent]),
    ...notificationTemplates.map((template) => [template, contentForNotification({ template: template as EmailTemplateKey, userName: "Aanya Rao", profileUrl: site, details: richDetails, ...footer })] as [string, EmailContent]),
  ];
}

Deno.test("signup email uses the direct Setuvara confirmation URL and accessible CTA", async () => {
  const confirmationUrl = "https://setuvara.com/auth/confirm?next=%2Fapp%2Fidentity&token_hash=preview-only-token&type=email";
  const content = contentForAuth({ template: "signup", url: confirmationUrl, handle: "aanya" });
  const rendered = await renderEmail(content);

  if (content.subject !== "Confirm your Setuvara") throw new Error("Unexpected signup subject");
  if (!rendered.html.includes("Confirm my email")) throw new Error("Signup CTA is missing");
  if (!rendered.html.includes("setuvara.com/<strong")) throw new Error("Signup identity block should show the claimed handle");
  if (!rendered.html.includes("/auth/confirm?")) throw new Error("Direct confirmation route is missing");
  if (rendered.html.includes("/verify?")) throw new Error("Hosted Supabase verification URL must not be rendered");
  if (!rendered.html.includes("<table")) throw new Error("Email-client-safe table layout is missing");
  if (!rendered.html.includes("setuvara-mark.png")) throw new Error("Existing Setuvara mark is missing");
  if (!rendered.html.includes("max-width:600px")) throw new Error("Fluid 600px email layout is missing");
  if (!rendered.html.includes("max-width: 480px")) throw new Error("Mobile email styles are missing");
  if (!rendered.text.includes(confirmationUrl)) throw new Error("Plain-text fallback must include the confirmation URL");
  if (rendered.html.toLowerCase().includes("unsubscribe")) throw new Error("Essential security mail must not offer an unsubscribe action");
});

Deno.test("signup ignores an invalid handle instead of rendering it", async () => {
  const content = contentForAuth({ template: "signup", url: `${site}/auth/confirm?token_hash=x&type=email`, handle: "<script>" });
  const rendered = await renderEmail(content);
  if (content.object) throw new Error("Invalid handles must not produce an identity block");
  if (rendered.html.includes("<script>")) throw new Error("Handle must never be rendered unescaped");
});

Deno.test("optional notification unsubscribe and preference links are distinct", async () => {
  const content = contentForNotification({ template: "new_connection", userName: "Aanya", profileUrl: site, details: [{ label: "name", value: "Marco" }], ...footer });
  const rendered = await renderEmail(content);

  if (!rendered.html.includes("/api/email/unsubscribe?token=preview-only-token")) throw new Error("Scoped unsubscribe link is missing");
  if (!rendered.html.includes("/app/settings/notifications")) throw new Error("Preference-center link is missing");
  if (content.headline !== "You met Marco.") throw new Error("Connection template does not use the provided name");
});

Deno.test("connection object uses real context and never invents a Mode", async () => {
  const content = contentForNotification({ template: "new_connection", userName: "Aanya", profileUrl: site, details: richDetails.filter((d) => ["name", "event", "city", "date", "role", "company"].includes(d.label)), ...footer });
  const rendered = await renderEmail(content);
  for (const expected of ["Marco Silva", "Head of Sales · Northlight", "Slush · Helsinki", "09 Oct 2026", ">Where<", ">When<"]) {
    if (!rendered.html.includes(expected)) throw new Error(`Connection card is missing ${expected}`);
  }
  if (rendered.html.includes(">Mode<")) throw new Error("Mode must only render when the delivery context provides it");
  if (content.subject !== "You met Marco") throw new Error("Connection subject should lead with the first name");
});

Deno.test("milestone ladder matches the app's Passport registry", () => {
  const rarity = (value: string) => value[0].toUpperCase() + value.slice(1);
  if (EMAIL_MILESTONES.length !== MILESTONES.length) throw new Error("Milestone count drifted from the app");
  for (const milestone of MILESTONES) {
    const mirrored = EMAIL_MILESTONES.find((item) => item.threshold === milestone.threshold);
    if (!mirrored || mirrored.name !== milestone.name) throw new Error(`Milestone ${milestone.threshold} name drifted`);
    const appRewards = PASSPORT_REWARDS.filter((reward) => reward.milestone === milestone.threshold);
    if (mirrored.rewards.length !== appRewards.length) throw new Error(`Milestone ${milestone.threshold} rewards drifted`);
    for (const reward of appRewards) {
      if (!mirrored.rewards.some((item) => item.name === reward.name && item.rarity === rarity(reward.rarity))) throw new Error(`Reward ${reward.id} drifted`);
    }
  }
});

Deno.test("every template is Outlook-safe, dark-mode ready and keeps footer rules", async () => {
  for (const [name, content] of allContent()) {
    const rendered = await renderEmail(content);
    if (content.action && !rendered.html.includes("v:rect")) throw new Error(`${name} CTA lacks the Outlook VML fallback`);
    if (!rendered.html.includes("prefers-color-scheme: dark")) throw new Error(`${name} lacks dark-mode styles`);
    if (!rendered.html.includes('name="color-scheme"')) throw new Error(`${name} lacks the color-scheme meta`);
    const images = [...rendered.html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]);
    if (images.some((src) => !/\/email\/(setuvara-mark|cut-paper|cut-ink)\.png$/.test(src))) throw new Error(`${name} uses an unexpected image`);
    if (content.category === "security" && rendered.html.toLowerCase().includes("unsubscribe")) throw new Error(`${name} security mail must not offer unsubscribe`);
    if (content.category === "lifecycle" && !rendered.html.includes("/api/email/unsubscribe")) throw new Error(`${name} lifecycle mail must offer unsubscribe`);
    if (!rendered.text.includes("setuvara")) throw new Error(`${name} plain text lost the wordmark`);
  }
});

Deno.test("email templates render without tracking pixels or em dashes", async () => {
  for (const [name, content] of allContent()) {
    const rendered = await renderEmail(content);
    const prose = [content.subject, content.preview, content.headline, content.eyebrow, ...content.paragraphs, ...(content.support ?? []), content.note ?? ""].join("\n");
    if (prose.includes("—") || rendered.html.includes("—") || rendered.text.includes("—")) throw new Error(`${name} contains an em dash`);
    if (/width=["']?1["']?[^>]*height=["']?1/i.test(rendered.html)) throw new Error(`${name} contains a tracking pixel`);
  }
});
