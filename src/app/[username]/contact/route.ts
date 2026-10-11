import { resolveStoredLink, providerForLink } from "@/lib/links/providers";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUsername, normalizeUsername } from "@/lib/usernames";

/**
 * "Save contact" for a Mode (?mode=personal|event|business, default business):
 * a vCard built only from what the owner already shows publicly in that Mode
 * (RLS hides everything else).
 */
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  const username = normalizeUsername((await params).username);
  if (!isAllowedUsername(username)) return notFound();

  const requested = new URL(request.url).searchParams.get("mode") ?? "business";
  if (requested !== "personal" && requested !== "event" && requested !== "business") return notFound();
  const slug = requested;
  const work = slug === "business";

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id, username, display_name, bio").eq("username", username).eq("is_published", true).maybeSingle();
  if (!profile) return notFound();
  const { data: mode } = await supabase.from("profile_modes").select("id, settings").eq("profile_id", profile.id).eq("slug", slug).eq("is_enabled", true).maybeSingle();
  if (!mode) return notFound();
  const { data: links } = await supabase.from("profile_links").select("title, url, link_type").eq("profile_id", profile.id).eq("mode_id", mode.id).eq("is_visible", true).order("sort_order");

  const settings = (mode.settings ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof settings[key] === "string" ? String(settings[key]).trim() : "");
  const origin = new URL(request.url).origin;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escape(profile.display_name)}`,
    `N:${escape(lastName(profile.display_name))};${escape(firstName(profile.display_name))};;;`,
  ];
  const city = text(slug === "personal" ? "location" : "city");
  if (work && text("company")) lines.push(`ORG:${escape(text("company"))}`);
  if (slug !== "personal" && text("role")) lines.push(`TITLE:${escape(text("role"))}`);
  if (city) lines.push(`ADR;TYPE=${work ? "WORK" : "HOME"}:;;;${escape(city)};;;`);
  for (const link of links ?? []) {
    const provider = providerForLink(link.link_type);
    const destination = resolveStoredLink(provider.id, link.url);
    if (!destination) continue;
    if (/^mailto:/i.test(destination.url)) lines.push(`EMAIL;TYPE=${work ? "WORK" : "INTERNET"}:${escape(destination.url.slice(7))}`);
    else if (/^tel:/i.test(destination.url)) lines.push(`TEL;TYPE=${work ? "WORK," : ""}VOICE:${escape(destination.url.slice(4))}`);
    else if (/^https?:/i.test(destination.url)) lines.push(`URL;TYPE=${provider.id === "linkedin" ? "LinkedIn" : work ? "WORK" : "HOME"}:${escape(destination.url)}`);
  }
  lines.push(`URL;TYPE=Setuvara:${escape(`${origin}/${profile.username}?mode=${slug}&source=contact`)}`);
  const note = text(slug === "business" ? "description" : slug === "event" ? "hereToMeet" : "note") || profile.bio;
  if (note) lines.push(`NOTE:${escape(note)}`);
  lines.push("END:VCARD");

  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${profile.username}.vcf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

function escape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/** vCard lines fold at 75 octets. */
function fold(line: string) {
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    if (Buffer.byteLength(current + char) > (parts.length ? 74 : 75)) { parts.push(current); current = ""; }
    current += char;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const firstName = (name: string) => name.trim().split(/\s+/).slice(0, -1).join(" ") || name.trim();
const lastName = (name: string) => (name.trim().split(/\s+/).length > 1 ? name.trim().split(/\s+/).at(-1) ?? "" : "");
