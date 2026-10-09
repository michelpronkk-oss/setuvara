import { contentForAuth, contentForNotification, renderEmail, type EmailTemplateKey } from "./email.tsx";

const root = Deno.cwd().replaceAll("\\", "/").replace(/\/$/, "");
const relativeOutput = (Deno.args[0] ?? ".next/email-previews").replaceAll("\\", "/");
if (relativeOutput.startsWith("/") || relativeOutput.split("/").includes("..")) throw new Error("Preview output must stay inside the Setuvara repository");
const normalizedOutput = `${root}/${relativeOutput.replace(/^\.\//, "")}`;

const authTemplates: { key: EmailTemplateKey; url?: string; code?: string }[] = [
  { key: "signup", url: "https://setuvara.com/auth/confirm?next=%2Fapp%2Fidentity&token_hash=preview-only&type=email" },
  { key: "invite", url: "https://setuvara.com/auth/confirm?token_hash=preview-only&type=invite" },
  { key: "magiclink", url: "https://setuvara.com/auth/confirm?token_hash=preview-only&type=magiclink" },
  { key: "recovery", url: "https://setuvara.com/auth/confirm?token_hash=preview-only&type=recovery" },
  { key: "email_change", url: "https://setuvara.com/auth/confirm?token_hash=preview-only&type=email_change" },
  { key: "reauthentication", code: "123456" },
  { key: "account_notice" },
];
const notificationTemplates: EmailTemplateKey[] = [
  "welcome", "new_connection", "connection_recap", "guest_claimed", "passport_milestone", "passport_stamp",
  "creator_application", "creator_approved", "creator_collaboration", "business_action",
];
const fixtures = [
  ...authTemplates.map(({ key, url, code }) => [key, contentForAuth({ template: key, url, code })] as const),
  ...notificationTemplates.map((template) => [template, contentForNotification({
    template,
    userName: "Aanya Rao",
    profileUrl: "https://setuvara.com",
    details: [{ label: "name", value: "Marco Silva" }, { label: "event", value: "Slush" }, { label: "count", value: "4" }],
    unsubscribeUrl: "https://setuvara.com/api/email/unsubscribe?token=preview-only-token",
    preferencesUrl: "https://setuvara.com/app/settings/notifications",
  })] as const),
];

await Deno.mkdir(normalizedOutput, { recursive: true });
for (const [name, content] of fixtures) {
  const rendered = await renderEmail(content);
  await Deno.writeTextFile(`${normalizedOutput}/${name}.html`, rendered.html);
  await Deno.writeTextFile(`${normalizedOutput}/${name}.txt`, rendered.text);
}
console.log(`Rendered ${fixtures.length} deterministic Setuvara email previews to .next/email-previews.`);
