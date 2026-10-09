/// <reference types="npm:@types/react@19.3.0" />

import React, { type JSX as ReactJSX } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  render,
} from "react-email";

declare global {
  // Deno's React 19 JSX transform still expects the global JSX namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
  }
}

export type EmailCategory = "security" | "connection" | "reward" | "lifecycle" | "product";
export type EmailTemplateKey =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "reauthentication"
  | "account_notice"
  | "welcome"
  | "new_connection"
  | "connection_recap"
  | "guest_claimed"
  | "passport_milestone"
  | "passport_stamp"
  | "creator_application"
  | "creator_approved"
  | "creator_collaboration"
  | "business_action";

export type EmailContent = {
  category: EmailCategory;
  subject: string;
  preview: string;
  eyebrow: string;
  headline: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  actionTone?: "ink" | "coral";
  details?: { label: string; value: string }[];
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  supportUrl?: string;
};

const palette = {
  ink: "#0D0D0D",
  paper: "#F5F4EF",
  coral: "#FF5A4F",
  lime: "#C7FF4A",
  blue: "#AFCBFF",
  body: "#34332F",
  muted: "#6B6962",
  hairline: "#DCD9CF",
};

const categorySignal: Record<EmailCategory, { name: string; fill: string; color: string }> = {
  security: { name: "SECURITY", fill: palette.ink, color: palette.paper },
  connection: { name: "CONNECTION", fill: palette.coral, color: palette.ink },
  reward: { name: "REWARD", fill: palette.lime, color: palette.ink },
  lifecycle: { name: "SETUVARA", fill: palette.coral, color: palette.ink },
  product: { name: "PRODUCT", fill: palette.blue, color: palette.ink },
};

const safeUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

export function EmailDocument({ content }: { content: EmailContent }) {
  const signal = categorySignal[content.category];
  const actionUrl = content.action ? safeUrl(content.action.url) : undefined;
  const unsubscribeUrl = content.unsubscribeUrl ? safeUrl(content.unsubscribeUrl) : undefined;
  const preferencesUrl = content.preferencesUrl ? safeUrl(content.preferencesUrl) : undefined;
  const supportUrl = content.supportUrl ? safeUrl(content.supportUrl) : undefined;
  const needsPreferences = content.category !== "security";
  const actionIsCoral = content.actionTone === "coral" || content.category !== "security";

  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{`
          @media (prefers-color-scheme: dark) {
            .sv-canvas { background-color: ${palette.ink} !important; }
            .sv-object { background-color: #1A1918 !important; color: ${palette.paper} !important; }
            .sv-primary { color: ${palette.paper} !important; }
            .sv-body { color: #D6D3CB !important; }
            .sv-muted { color: #A9A69E !important; }
            .sv-hairline { border-color: #2E2D2A !important; }
          }
          @media only screen and (max-width: 480px) {
            .sv-gutter { padding-left: 22px !important; padding-right: 22px !important; }
            .sv-main { padding-top: 32px !important; padding-bottom: 34px !important; }
            .sv-headline { font-size: 34px !important; line-height: 1.08 !important; }
            .sv-button { display: block !important; box-sizing: border-box !important; width: 100% !important; }
            .sv-footer-note { display: none !important; }
          }
        `}</style>
      </Head>
      <Preview>{content.preview}</Preview>
      <Body className="sv-canvas" style={{ margin: 0, backgroundColor: palette.paper, color: palette.ink, fontFamily: "Geist, Helvetica Neue, Helvetica, Arial, sans-serif" }}>
        <Container className="sv-canvas" style={{ width: "100%", maxWidth: 600, margin: "0 auto", padding: "32px 12px", backgroundColor: palette.paper }}>
          <Section style={{ backgroundColor: "#FFFFFF", border: `1px solid ${palette.hairline}` }}>
            <Section className="sv-object sv-hairline sv-gutter" style={{ padding: "22px 48px 20px", borderBottom: `1px solid ${palette.hairline}`, backgroundColor: "#FFFFFF" }}>
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0"><tbody><tr>
                <td width="34" valign="middle"><Img src="https://setuvara.com/email/setuvara-mark.png" width="26" height="26" alt="" style={{ display: "block", width: 26, height: 26 }} /></td>
                <td valign="middle"><Text className="sv-primary" style={{ margin: 0, color: palette.ink, fontSize: 20, fontWeight: 800, letterSpacing: "-1px" }}>setuvara</Text></td>
                <td align="right" valign="middle"><Text style={{ display: "inline-block", margin: 0, padding: "6px 8px", borderRadius: 999, backgroundColor: signal.fill, color: signal.color, fontFamily: "Geist Mono, Consolas, Courier New, monospace", fontSize: 10, fontWeight: 700, letterSpacing: "1.2px" }}>{signal.name}</Text></td>
              </tr></tbody></table>
            </Section>

            <Section className="sv-gutter sv-main" style={{ padding: "42px 48px 46px" }}>
              <Text style={{ margin: "0 0 16px", color: palette.coral, fontFamily: "Geist Mono, Consolas, Courier New, monospace", fontSize: 11, fontWeight: 700, letterSpacing: "2px" }}><span aria-hidden="true">━ </span>{content.eyebrow.toUpperCase()}</Text>
              <Heading as="h1" className="sv-primary sv-headline" style={{ margin: "0 0 20px", color: palette.ink, fontFamily: "Bricolage Grotesque, Helvetica Neue, Helvetica, Arial, sans-serif", fontSize: 40, lineHeight: 1.06, fontWeight: 800, letterSpacing: "-2px" }}>{content.headline}</Heading>
              {content.paragraphs.map((paragraph, index) => <Text className="sv-body" key={`${index}:${paragraph}`} style={{ margin: "0 0 16px", color: palette.body, fontSize: 16, lineHeight: 1.6 }}>{paragraph}</Text>)}

              {content.details?.length ? <Section className="sv-object" style={{ margin: "24px 0", padding: "22px 24px", backgroundColor: palette.ink, color: palette.paper, borderRadius: 20 }}>
                {content.details.map((detail, index) => <Text key={`${detail.label}:${index}`} style={{ margin: index ? "16px 0 0" : 0, color: palette.paper, fontSize: 15, lineHeight: 1.45 }}><span style={{ display: "block", marginBottom: 5, color: "#A9A69E", fontFamily: "Geist Mono, Consolas, Courier New, monospace", fontSize: 10, letterSpacing: "1.5px" }}>{detail.label.toUpperCase()}</span><strong>{detail.value}</strong></Text>)}
              </Section> : null}

              {actionUrl && content.action ? <Section className="sv-action-row" style={{ width: "100%", margin: "28px 0 24px" }}>
                <Button href={actionUrl} className="sv-button" style={{ display: "inline-block", padding: "18px 28px", backgroundColor: actionIsCoral ? palette.coral : palette.ink, color: actionIsCoral ? palette.ink : palette.paper, borderRadius: 999, fontSize: 15, lineHeight: "20px", fontWeight: 700, textDecoration: "none", textAlign: "center" }}>{content.action.label} &nbsp;→</Button>
              </Section> : null}
              {actionUrl ? <Text className="sv-muted" style={{ margin: "18px 0 0", color: palette.muted, fontSize: 13, lineHeight: 1.6 }}>If the button does not work, copy this link into your browser:<br /><Link href={actionUrl} style={{ color: palette.ink, wordBreak: "break-all" }}>{actionUrl}</Link></Text> : null}
            </Section>

            <Hr className="sv-hairline" style={{ margin: 0, border: 0, borderTop: `1px solid ${palette.hairline}` }} />
            <Section className="sv-gutter" style={{ padding: "24px 48px 30px" }}>
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0"><tbody><tr>
                <td><Text className="sv-primary" style={{ margin: 0, color: palette.ink, fontSize: 21, fontWeight: 800, letterSpacing: "-1px" }}>setuvara</Text></td>
                <td align="right" className="sv-footer-note"><Text className="sv-muted" style={{ margin: 0, color: palette.muted, fontFamily: "Geist Mono, Consolas, Courier New, monospace", fontSize: 10, letterSpacing: "1.3px" }}>YOUR IDENTITY. YOUR CONNECTIONS.</Text></td>
              </tr></tbody></table>
              {content.category !== "security" ? <Text style={{ margin: "20px 0 0", fontSize: 13, lineHeight: 1.8 }}>
                {needsPreferences && unsubscribeUrl ? <Link href={unsubscribeUrl} style={{ color: palette.ink, marginRight: 18 }}>Unsubscribe</Link> : null}
                {preferencesUrl ? <Link href={preferencesUrl} style={{ color: palette.ink, marginRight: 18 }}>Email preferences</Link> : null}
                {supportUrl ? <Link href={supportUrl} style={{ color: palette.ink }}>Support</Link> : null}
              </Text> : null}
              <Text className="sv-muted" style={{ margin: "18px 0 0", color: palette.muted, fontSize: 12, lineHeight: 1.6 }}>{content.category === "security" ? "This is an essential account security email." : "You are receiving this because of activity on your Setuvara account."} © 2026 Setuvara</Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderEmail(content: EmailContent) {
  const element = <EmailDocument content={content} />;
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}

export function contentForAuth(input: { template: EmailTemplateKey; url?: string; code?: string; handle?: string; userName?: string }): EmailContent {
  const authContent: Partial<Record<EmailTemplateKey, Omit<EmailContent, "action"> & { actionLabel?: string }>> = {
    signup: { category: "security", subject: "Confirm your Setuvara", preview: "Confirm your email to finish creating your Setuvara.", eyebrow: "CONFIRM YOUR IDENTITY", headline: "One identity. Every version of you.", paragraphs: ["Confirm your email address to finish creating your Setuvara."], actionLabel: "Confirm my Setuvara" },
    invite: { category: "security", subject: "You’re invited to Setuvara", preview: "Your Setuvara identity is waiting.", eyebrow: "YOUR SETUVARA INVITATION", headline: "Your identity starts here.", paragraphs: ["Confirm your email address to accept your invitation."], actionLabel: "Accept invitation" },
    magiclink: { category: "security", subject: "Your Setuvara sign-in link", preview: "A secure link to continue to your identity.", eyebrow: "SIGN IN TO SETUVARA", headline: "Continue to your identity.", paragraphs: ["Use this secure link to sign in to your Setuvara account."], actionLabel: "Sign in to Setuvara" },
    recovery: { category: "security", subject: "Reset your Setuvara password", preview: "Choose a new password for your Setuvara.", eyebrow: "PASSWORD RESET", headline: "Choose a new password.", paragraphs: ["We received a request to reset your Setuvara password."], actionLabel: "Reset password" },
    email_change: { category: "security", subject: "Confirm your Setuvara email change", preview: "Confirm the email address change for your account.", eyebrow: "EMAIL ADDRESS CHANGE", headline: "Confirm your email address.", paragraphs: ["Use this secure link to confirm the requested email address change."], actionLabel: "Confirm email change" },
    reauthentication: { category: "security", subject: "Your Setuvara verification code", preview: "Your Setuvara verification code.", eyebrow: "SECURITY CHECK", headline: "Confirm it’s you.", paragraphs: ["Use this code to verify your Setuvara account."], actionLabel: undefined },
  };
  const base = authContent[input.template] ?? { category: "security" as const, subject: "A Setuvara account update", preview: "A security update for your Setuvara account.", eyebrow: "ACCOUNT SECURITY", headline: "Your account was updated.", paragraphs: ["There has been an update to your Setuvara account. If you did not expect this, contact Setuvara support."], actionLabel: undefined };
  return {
    ...base,
    headline: input.template === "signup" && input.handle ? "One more step." : base.headline,
    paragraphs: input.template === "signup" && input.handle ? [`Confirm your email and setuvara.com/${input.handle} is yours.`] : input.template === "reauthentication" && input.code ? [`Your verification code is ${input.code}.`] : base.paragraphs,
    details: input.template === "signup" && input.handle ? [{ label: "YOUR IDENTITY", value: `setuvara.com/${input.handle}` }] : undefined,
    action: input.url && base.actionLabel ? { label: base.actionLabel, url: input.url } : undefined,
    actionTone: input.template === "signup" ? "coral" : "ink",
  };
}

export function contentForNotification(input: { template: EmailTemplateKey; userName: string; profileUrl: string; details?: { label: string; value: string }[]; unsubscribeUrl?: string; preferencesUrl: string }): EmailContent {
  const name = input.userName.trim() || "Your Setuvara";
  const generic = {
    welcome: { category: "lifecycle" as const, subject: "Your Setuvara starts here.", preview: "One identity. Different versions of you, ready for the moment.", eyebrow: "WELCOME TO SETUVARA", headline: "Your Setuvara starts here.", paragraphs: ["One identity can show the right side of you in every moment.", "Build your identity, choose a Mode, share it, and keep the connections that matter."], cta: "Build your identity", href: `${input.profileUrl}/app/identity` },
    new_connection: { category: "connection" as const, subject: "You met someone on Setuvara", preview: "A new connection, with the moment attached.", eyebrow: "YOU MET SOMEONE", headline: "You met someone.", paragraphs: ["A new connection is now part of your Setuvara."], cta: "View connection", href: `${input.profileUrl}/app/connections` },
    connection_recap: { category: "connection" as const, subject: "Your Setuvara connections are waiting", preview: "Your recent connections, together in one place.", eyebrow: "YOUR CONNECTIONS", headline: "A few people are now in your Connections.", paragraphs: ["Your recent connections are ready to revisit."], cta: "View connections", href: `${input.profileUrl}/app/connections` },
    guest_claimed: { category: "connection" as const, subject: "Someone you met claimed their Setuvara", preview: "A guest connection has joined Setuvara.", eyebrow: "CONNECTION UPDATE", headline: "Someone you met claimed their identity.", paragraphs: ["A person you connected with has joined Setuvara. Your connection remains in your network."], cta: "View connection", href: `${input.profileUrl}/app/connections` },
    passport_milestone: { category: "reward" as const, subject: "A Setuvara Passport milestone unlocked", preview: "Your real connections unlocked a new milestone.", eyebrow: "PASSPORT MILESTONE", headline: "A new milestone is yours.", paragraphs: ["Your Setuvara Passport has a new milestone, earned through real connections."], cta: "Open Passport", href: `${input.profileUrl}/app/passport` },
    passport_stamp: { category: "reward" as const, subject: "A new memory in your Setuvara Passport", preview: "A real place and moment, remembered.", eyebrow: "PASSPORT STAMP", headline: "A new memory was added.", paragraphs: ["Your Passport has a new stamp from a real connection moment."], cta: "View Passport", href: `${input.profileUrl}/app/passport` },
    creator_application: { category: "product" as const, subject: "Your Setuvara Creator application", preview: "An update about your Creator application.", eyebrow: "CREATOR", headline: "Your application is in.", paragraphs: ["We will be in touch when the Creator program is ready."], cta: "Open Setuvara", href: input.profileUrl },
    creator_approved: { category: "product" as const, subject: "You’re approved for Setuvara Creator", preview: "Your Creator application has been approved.", eyebrow: "CREATOR", headline: "You’re in.", paragraphs: ["Your Creator application has been approved."], cta: "Open Setuvara", href: input.profileUrl },
    creator_collaboration: { category: "product" as const, subject: "A Setuvara Creator collaboration", preview: "A new collaboration request is waiting.", eyebrow: "CREATOR COLLABORATION", headline: "A collaboration is waiting.", paragraphs: ["Open Setuvara to review the collaboration details."], cta: "Open Setuvara", href: input.profileUrl },
    business_action: { category: "product" as const, subject: "A Setuvara Business update", preview: "An update about your Business profile.", eyebrow: "BUSINESS", headline: "There’s an update for you.", paragraphs: ["Open Setuvara to see your Business profile update."], cta: "Open Setuvara", href: input.profileUrl },
  };
  const content = generic[input.template as keyof typeof generic] ?? generic.welcome;
  const displayName = input.details?.find((detail) => detail.label === "name")?.value ?? name;
  const moment = input.details?.find((detail) => detail.label === "event")?.value;
  const count = input.details?.find((detail) => detail.label === "count")?.value;
  const subject = input.template === "new_connection" ? `You met ${displayName}.`
    : input.template === "guest_claimed" ? `${displayName} claimed their Setuvara.`
      : input.template === "connection_recap" && moment ? `${count ?? "New"} people from ${moment} are now in your Connections`
        : content.subject;
  const headline = input.template === "new_connection" ? `You met ${displayName}.`
    : input.template === "guest_claimed" ? `${displayName} claimed their Setuvara.`
      : input.template === "connection_recap" ? `You met ${count ?? "a few"} people.`
        : input.template === "passport_milestone" ? (input.details?.find((detail) => detail.label === "milestone")?.value ?? content.headline)
          : input.template === "passport_stamp" ? (input.details?.find((detail) => detail.label === "stamp")?.value ?? content.headline)
            : content.headline;
  return {
    category: content.category,
    subject,
    preview: content.preview,
    eyebrow: content.eyebrow,
    headline,
    paragraphs: input.template === "welcome" ? [`Hello ${name}.`, ...content.paragraphs] : content.paragraphs,
    action: { label: content.cta, url: `${input.profileUrl}${content.href.slice("https://setuvara.com".length)}` },
    details: input.template === "welcome" ? [{ label: "YOUR IDENTITY", value: input.details?.find((d) => d.label === "username")?.value ?? "setuvara.com" }] : input.details,
    unsubscribeUrl: input.unsubscribeUrl,
    preferencesUrl: input.preferencesUrl,
    supportUrl: undefined,
  };
}
