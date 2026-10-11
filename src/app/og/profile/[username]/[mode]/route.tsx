/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";

import { meetMarkBottom, meetMarkTop } from "@/components/marketing/brand";
import { getPublishedPublicMode, publicProfileTitle, publicSetting } from "@/lib/seo/public-profile";
import { memberTierForPlan } from "@/lib/billing/member-badge";
import { getUserBillingState } from "@/lib/billing/service";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { isAllowedUsername, normalizeUsername } from "@/lib/usernames";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const imageSize = { width: 1200, height: 630 };
const maxPhotoBytes = 2 * 1024 * 1024;
const modeColors = { personal: "#FF5A4F", event: "#C7FF4A", business: "#AFCBFF" } as const;
const modeLabels = { personal: "PERSONAL MODE", event: "EVENT MODE", business: "BUSINESS MODE" } as const;

type ProfileOgRouteProps = { params: Promise<{ username: string; mode: string }> };

function cleanText(value: string, limit: number) {
  const normalized = value.normalize("NFC").replace(/\s+/g, " ").trim();
  const points = Array.from(normalized);
  return points.length > limit ? `${points.slice(0, limit - 1).join("")}…` : normalized;
}

function settingContext(settings: Record<string, unknown>, mode: "personal" | "event" | "business") {
  const record = { settings };
  const values = mode === "personal"
    ? [publicSetting(record, "location", 80)]
    : mode === "event"
      ? [publicSetting(record, "eventName", 100), publicSetting(record, "city", 80), publicSetting(record, "dateLabel", 80), publicSetting(record, "role", 80)]
      : [publicSetting(record, "role", 80), publicSetting(record, "company", 100), publicSetting(record, "city", 80)];
  return cleanText(values.filter(Boolean).join(" · "), 96);
}

async function safeProfilePhoto(imagePath: string | null) {
  const config = getSupabaseConfig();
  if (!config || !imagePath) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from("profile-media").createSignedUrl(imagePath, 60);
    if (error || !data?.signedUrl) return null;

    const signedUrl = new URL(data.signedUrl);
    const supabaseOrigin = new URL(config.url).origin;
    if (signedUrl.origin !== supabaseOrigin || !signedUrl.pathname.includes("/storage/v1/object/sign/profile-media/")) return null;

    const response = await fetch(signedUrl, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (!contentType || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) return null;
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxPhotoBytes) return null;
    if (!response.body) return null;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxPhotoBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }

    const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    const isPng = bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isWebp = bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!isPng && !isJpeg && !isWebp) return null;

    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

function NotFoundImage() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

export async function GET(_request: Request, { params }: ProfileOgRouteProps) {
  const { username: rawUsername, mode: rawMode } = await params;
  const username = normalizeUsername(rawUsername);
  if (!isAllowedUsername(username) || !Object.hasOwn(modeColors, rawMode)) return NotFoundImage();

  const slug = rawMode as keyof typeof modeColors;
  const record = await getPublishedPublicMode(username, slug);
  if (!record) return NotFoundImage();

  const billing = await getUserBillingState(record.profile.id).catch(() => null);
  const memberTier = memberTierForPlan(billing?.plan ?? "free");
  const title = cleanText(publicProfileTitle(record.profile), 48);
  const handle = `@${record.profile.username}`;
  const context = settingContext(record.mode.settings, slug);
  const photo = await safeProfilePhoto(record.mode.image_path);
  const accent = modeColors[slug];
  const titleSize = title.length > 28 ? 54 : title.length > 20 ? 64 : 76;

  return new ImageResponse(
    (
      <div style={{ alignItems: "center", background: "#F5F4EF", color: "#0D0D0D", display: "flex", height: "100%", padding: 48, width: "100%" }}>
        <div style={{ alignItems: "center", background: accent, borderRadius: 28, display: "flex", flex: "none", height: 534, justifyContent: "center", overflow: "hidden", position: "relative", width: 380 }}>
          {photo ? <img alt="" src={photo} style={{ height: "100%", objectFit: "cover", width: "100%" }} /> : (
            <svg height="250" viewBox="0 0 100 100" width="250">
              <path d={meetMarkTop} fill="#0D0D0D" />
              <path d={meetMarkBottom} fill="#0D0D0D" />
            </svg>
          )}
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", height: 510, justifyContent: "space-between", minWidth: 0, paddingLeft: 56, paddingTop: 6, paddingBottom: 6 }}>
          <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
            <svg height="34" viewBox="0 0 100 100" width="34"><path d={meetMarkTop} fill="#0D0D0D" /><path d={meetMarkBottom} fill="#0D0D0D" /></svg>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1.5 }}>setuvara</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
            <div style={{ alignItems: "center", display: "flex", gap: 14 }}>
              <span style={{ color: "#55524D", fontSize: 16, fontWeight: 700, letterSpacing: 3 }}>{modeLabels[slug]}</span>
              {memberTier && (
                <span style={{ background: memberTier === "plus" ? "#FF5A4F" : "#D8CCA8", borderRadius: 999, color: "#0D0D0D", fontSize: 13, fontWeight: 800, letterSpacing: 1, padding: "9px 13px" }}>
                  SETUVARA {memberTier.toUpperCase()} MEMBER
                </span>
              )}
            </div>
            <span style={{ fontSize: titleSize, fontWeight: 800, letterSpacing: -3.5, lineHeight: 0.98, maxWidth: 650, overflow: "hidden" }}>{title}</span>
            <span style={{ color: "#55524D", fontSize: 24 }}>{handle}</span>
            <div style={{ background: accent, height: 6, marginTop: 6, width: 80 }} />
            {context && <span style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, maxWidth: 650 }}>{context}</span>}
          </div>
          <span style={{ color: "#55524D", fontSize: 20, letterSpacing: 0.2 }}>setuvara.com/{record.profile.username}</span>
        </div>
      </div>
    ),
    {
      ...imageSize,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
