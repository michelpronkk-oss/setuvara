/**
 * The Embed block's approved providers. A pasted link becomes the provider's own embed URL, or
 * nothing: no other site is ever framed on a profile. Pure functions, shared by the editor, the
 * registry and the public profile.
 */

export type EmbedProvider = "calendly" | "cal" | "typeform" | "tally" | "google_forms" | "substack";

export type EmbedMedia = {
  provider: EmbedProvider;
  /** Canonical page URL, opened in a new tab when the embed isn't shown. */
  url: string;
  embedUrl: string;
  /** Frame height in pixels on a profile. */
  height: number;
};

export const EMBED_PROVIDERS: Record<EmbedProvider, { name: string; kind: string }> = {
  calendly: { name: "Calendly", kind: "Booking" },
  cal: { name: "Cal.com", kind: "Booking" },
  typeform: { name: "Typeform", kind: "Form" },
  tally: { name: "Tally", kind: "Form" },
  google_forms: { name: "Google Forms", kind: "Form" },
  substack: { name: "Substack", kind: "Newsletter" },
};

export const EMBED_HINT = "Paste a Calendly, Cal.com, Typeform, Tally, Google Forms or Substack link.";

const SEGMENT = /^[A-Za-z0-9_.-]{1,80}$/;

function toUrl(input: string): URL | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export function parseEmbed(input: string): EmbedMedia | null {
  const url = toUrl(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "calendly.com" && parts.length >= 1 && parts.length <= 2 && parts.every((part) => SEGMENT.test(part))) {
    const path = parts.join("/");
    return { provider: "calendly", url: `https://calendly.com/${path}`, embedUrl: `https://calendly.com/${path}?embed_type=Inline&hide_gdpr_banner=1&embed_domain=setuvara.com`, height: 700 };
  }
  if ((host === "cal.com" || host === "app.cal.com") && parts.length >= 1 && parts.length <= 2 && parts.every((part) => SEGMENT.test(part)) && parts[0] !== "embed") {
    const path = parts.join("/");
    return { provider: "cal", url: `https://cal.com/${path}`, embedUrl: `https://cal.com/${path}/embed?layout=month_view`, height: 700 };
  }
  if ((host === "form.typeform.com" || /^[a-z0-9-]+\.typeform\.com$/.test(host)) && parts[0] === "to" && /^[A-Za-z0-9]{4,20}$/.test(parts[1] ?? "")) {
    return { provider: "typeform", url: `https://form.typeform.com/to/${parts[1]}`, embedUrl: `https://form.typeform.com/to/${parts[1]}?typeform-embed=embed-widget`, height: 560 };
  }
  if (host === "tally.so" && (parts[0] === "r" || parts[0] === "embed") && /^[A-Za-z0-9]{4,20}$/.test(parts[1] ?? "")) {
    return { provider: "tally", url: `https://tally.so/r/${parts[1]}`, embedUrl: `https://tally.so/embed/${parts[1]}?alignLeft=1&transparentBackground=1`, height: 560 };
  }
  if (host === "docs.google.com" && parts[0] === "forms" && parts[1] === "d" && parts[2] === "e" && /^[A-Za-z0-9_-]{20,120}$/.test(parts[3] ?? "")) {
    return { provider: "google_forms", url: `https://docs.google.com/forms/d/e/${parts[3]}/viewform`, embedUrl: `https://docs.google.com/forms/d/e/${parts[3]}/viewform?embedded=true`, height: 720 };
  }
  const substack = /^([a-z0-9-]{1,63})\.substack\.com$/.exec(host);
  if (substack && substack[1] !== "www" && substack[1] !== "open") {
    return { provider: "substack", url: `https://${substack[1]}.substack.com`, embedUrl: `https://${substack[1]}.substack.com/embed`, height: 180 };
  }
  return null;
}
