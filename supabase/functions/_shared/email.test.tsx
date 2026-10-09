import { contentForAuth, contentForNotification, renderEmail } from "./email.tsx";

Deno.test("signup email uses the direct Setuvara confirmation URL and accessible CTA", async () => {
  const confirmationUrl = "https://setuvara.com/auth/confirm?next=%2Fapp%2Fidentity&token_hash=preview-only-token&type=email";
  const content = contentForAuth({ template: "signup", url: confirmationUrl });
  const rendered = await renderEmail(content);

  if (content.subject !== "Confirm your Setuvara") throw new Error("Unexpected signup subject");
  if (!rendered.html.includes("Confirm my Setuvara")) throw new Error("Signup CTA is missing");
  if (!rendered.html.includes("/auth/confirm?")) throw new Error("Direct confirmation route is missing");
  if (rendered.html.includes("/verify?")) throw new Error("Hosted Supabase verification URL must not be rendered");
  if (!rendered.html.includes("<table")) throw new Error("Email-client-safe table layout is missing");
  if (!rendered.html.includes("setuvara-mark.png")) throw new Error("Existing Setuvara mark is missing");
  if (!rendered.html.includes("max-width:600px")) throw new Error("Fluid 600px email layout is missing");
  if (!rendered.html.includes("max-width: 480px")) throw new Error("Mobile email styles are missing");
  if (!rendered.text.includes(confirmationUrl)) throw new Error("Plain-text fallback must include the confirmation URL");
  if (rendered.html.toLowerCase().includes("unsubscribe")) throw new Error("Essential security mail must not offer an unsubscribe action");
});

Deno.test("optional notification unsubscribe and preference links are distinct", async () => {
  const content = contentForNotification({
    template: "new_connection",
    userName: "Aanya",
    profileUrl: "https://setuvara.com",
    details: [{ label: "name", value: "Marco" }],
    unsubscribeUrl: "https://setuvara.com/api/email/unsubscribe?token=preview-only-token",
    preferencesUrl: "https://setuvara.com/app/settings/notifications",
  });
  const rendered = await renderEmail(content);

  if (!rendered.html.includes("/api/email/unsubscribe?token=preview-only-token")) throw new Error("Scoped unsubscribe link is missing");
  if (!rendered.html.includes("/app/settings/notifications")) throw new Error("Preference-center link is missing");
  if (content.headline !== "You met Marco.") throw new Error("Connection template does not use the provided name");
});

Deno.test("email templates render without tracking pixels or em dashes", async () => {
  const authTemplates = ["signup", "invite", "magiclink", "recovery", "email_change", "reauthentication", "account_notice"] as const;
  for (const template of authTemplates) {
    const content = contentForAuth({ template, url: "https://setuvara.com/auth/confirm?next=%2Fapp%2Fidentity", code: "123456" });
    const rendered = await renderEmail(content);
    if (rendered.html.includes("—") || rendered.text.includes("—")) throw new Error(`${template} contains an em dash`);
    if (/width=["']?1["']?[^>]*height=["']?1/i.test(rendered.html)) throw new Error(`${template} contains a tracking pixel`);
  }
  const notificationTemplates = ["welcome", "new_connection", "connection_recap", "guest_claimed", "passport_milestone", "passport_stamp", "creator_application", "creator_approved", "creator_collaboration", "business_action"] as const;
  for (const template of notificationTemplates) {
    const content = contentForNotification({
      template,
      userName: "Setuvara Member",
      profileUrl: "https://setuvara.com",
      details: [{ label: "name", value: "Aanya" }, { label: "event", value: "Slush" }, { label: "count", value: "4" }],
      unsubscribeUrl: "https://setuvara.com/api/email/unsubscribe?token=preview-only-token",
      preferencesUrl: "https://setuvara.com/app/settings/notifications",
    });
    const rendered = await renderEmail(content);
    if (rendered.html.includes("—") || rendered.text.includes("—")) throw new Error(`${template} contains an em dash`);
    if (/width=["']?1["']?[^>]*height=["']?1/i.test(rendered.html)) throw new Error(`${template} contains a tracking pixel`);
  }
});
