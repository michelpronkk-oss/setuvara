import { contentForAuth, contentForNotification, renderEmail, type EmailContent, type EmailTemplateKey } from "./email.tsx";

const root = Deno.cwd().replaceAll("\\", "/").replace(/\/$/, "");
const relativeOutput = (Deno.args[0] ?? ".next/email-previews").replaceAll("\\", "/");
if (relativeOutput.startsWith("/") || relativeOutput.split("/").includes("..")) throw new Error("Preview output must stay inside the Setuvara repository");
const normalizedOutput = `${root}/${relativeOutput.replace(/^\.\//, "")}`;

// Preview-only fixtures. Names and places here never reach application tables or the dispatcher.
const site = "https://setuvara.com";
const footer = { unsubscribeUrl: `${site}/api/email/unsubscribe?token=preview-only-token`, preferencesUrl: `${site}/app/settings/notifications` };
const d = (pairs: [string, string][]) => pairs.map(([label, value]) => ({ label, value }));
const note = (template: EmailTemplateKey, details: [string, string][], userName = "Aanya Rao") =>
  contentForNotification({ template, userName, profileUrl: site, details: d(details), ...footer });
const confirm = (type: string) => `${site}/auth/confirm?next=%2Fapp%2Fidentity&token_hash=preview-only&type=${type}`;

const fixtures: [string, EmailContent][] = [
  ["signup", contentForAuth({ template: "signup", url: confirm("email"), handle: "aanya" })],
  ["signup-no-handle", contentForAuth({ template: "signup", url: confirm("email") })],
  ["invite", contentForAuth({ template: "invite", url: confirm("invite") })],
  ["magiclink", contentForAuth({ template: "magiclink", url: confirm("magiclink") })],
  ["recovery", contentForAuth({ template: "recovery", url: confirm("recovery"), email: "aanya@lumenlabs.example" })],
  ["email_change", contentForAuth({ template: "email_change", url: confirm("email_change"), email: "aanya@lumenlabs.example" })],
  ["reauthentication", contentForAuth({ template: "reauthentication", code: "482913" })],
  ["account_notice", contentForAuth({ template: "account_notice" })],

  ["welcome", note("welcome", [["username", "setuvara.com/aanya"]])],
  ["new_connection", note("new_connection", [["name", "Marco Silva"], ["event", "Slush"], ["city", "Helsinki"], ["date", "09 Oct 2026"], ["role", "Head of Sales"], ["company", "Northlight"]])],
  ["connection_recap", note("connection_recap", [["count", "12"], ["event", "Slush"], ["city", "Helsinki"], ["dates", "08–09 Oct 2026"], ["person 1", "Marco Silva"], ["person 2", "Aanya Rao"], ["person 3", "Noah Chen"], ["person 4", "Lena Fischer"], ["person 5", "Jonas Berg"], ["more", "+7"]])],
  ["guest_claimed", note("guest_claimed", [["name", "Marco Silva"], ["username", "setuvara.com/marco"]])],
  ["passport_milestone", note("passport_milestone", [["milestone", "50 Connections"], ["unlocked", "2026-10-09"]])],
  ["passport_stamp", note("passport_stamp", [["stamp", "Amsterdam"], ["stamp_subtitle", "Netherlands"], ["stamp_type", "city"], ["stamp_date", "2026-10-09"]])],
  ["creator_application", note("creator_application", [["handle", "meyvor"], ["niche", "Music · Live streams"], ["platforms", "Twitch · YouTube"]])],
  ["creator_approved", note("creator_approved", [["handle", "meyvor"], ["niche", "Music · Live streams"], ["platforms", "Twitch · YouTube"]])],
  ["creator_collaboration", note("creator_collaboration", [["brand", "Northwind Audio"], ["project", "Spring launch stream"], ["budget", "€2,000–€3,500"], ["format", "2 live segments"], ["timing", "March 2027"], ["message", "We love your late-night sets. Want to build the launch stream with us?"]])],
  ["business_action", note("business_action", [["action", "Lena|left a review|2 hours ago"], ["action", "Tom|booked a call for Thursday|Yesterday"], ["action", "Priya|asked for a quote|Yesterday"]])],

  // Stress cases.
  ["stress-connection-long", note("new_connection", [["name", "Maximiliana-Alexandria Vandenberghe-Okonkwo"], ["event", "International Conference on Sustainable Energy Infrastructure"], ["city", "Llanfairpwllgwyngyll"], ["date", "09 Oct 2026"], ["role", "Senior Director of Strategic Partnerships"], ["company", "Northlight Renewable Infrastructure Holdings International"]])],
  ["stress-connection-minimal", note("new_connection", [["name", "Noah"]])],
  ["stress-recap-no-event", note("connection_recap", [["count", "3"], ["person 1", "Marco Silva"], ["person 2", "Noah Chen"], ["person 3", "Priya Nair"]])],
  ["stress-milestone-1000", note("passport_milestone", [["milestone", "1000 Connections"], ["unlocked", "2027-06-18"]])],
  ["stress-stamp-long", note("passport_stamp", [["stamp", "Llanfairpwllgwyngyll"], ["stamp", "Web Summit"], ["stamp_type", "city"], ["stamp_date", "2026-10-09"]])],
  ["stress-long-url", contentForAuth({ template: "recovery", url: `${site}/auth/confirm?next=%2Fapp%2Fidentity&token_hash=${"a1B2c3D4e5F6g7H8".repeat(8)}&type=recovery`, email: "maximiliana.vandenberghe-okonkwo@northlight-renewables.example" })],
];

await Deno.mkdir(normalizedOutput, { recursive: true });
for (const [name, content] of fixtures) {
  const rendered = await renderEmail(content);
  await Deno.writeTextFile(`${normalizedOutput}/${name}.html`, rendered.html);
  await Deno.writeTextFile(`${normalizedOutput}/${name}.txt`, rendered.text);
}
console.log(`Rendered ${fixtures.length} deterministic Setuvara email previews to ${relativeOutput}.`);
