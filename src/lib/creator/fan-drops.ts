/**
 * Fan Drops: who can open a Creator Work piece and when it goes out. The database
 * (20261024110000_fan_drops.sql, can_view_creator_block) decides; this names things for pages.
 */

export const FAN_AUDIENCES = ["followers", "connections", "subscribers", "members"] as const;
export type FanAudience = (typeof FAN_AUDIENCES)[number];
export const FAN_AUDIENCE_LABEL: Record<FanAudience, string> = { followers: "Followers", connections: "Connections", subscribers: "Subscribers", members: "Members" };

export type WorkAccess = { profile_block_id: string; access_level: FanAudience | "public" | "purchase"; teaser_title: string | null };
export type WorkDrop = { id: string; profile_block_id: string; starts_at: string | null; early_access_level: FanAudience | null; early_access_starts_at: string | null; status: string };

/** Who is in an audience, in a sentence a creator and a fan both understand. */
export function fanAudienceNote(audience: FanAudience) {
  return {
    followers: "People who follow you on Setuvara see it.",
    connections: "People you're connected with on Setuvara see it.",
    subscribers: "Confirmed subscribers of your newsletter see it, when signed in with the same email.",
    members: "Your paying members see it.",
  }[audience];
}

/** What a fan does to get in. */
export function fanUnlockHint(audience: FanAudience | "purchase", firstName: string) {
  return {
    followers: `Follow ${firstName} to unlock`,
    connections: `For ${firstName}'s connections`,
    subscribers: `For subscribers of ${firstName}'s newsletter`,
    members: `For ${firstName}'s members`,
    purchase: "Unlocked with a purchase",
  }[audience];
}

/** An ISO instant as the value of a datetime-local input, in the browser's own zone. */
export function toLocalInput(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type Summary = {
  drops?: { profile_block_id: string; title: string; status: string; starts_at: string | null; early_access_level: FanAudience | null; is_accessible: boolean }[];
  locked_content?: { profile_block_id: string; access_level: FanAudience | "purchase"; teaser_title: string | null; is_accessible: boolean }[];
};

/**
 * The locked cards a visitor sees, from get_creator_public_summary (decided in the database for
 * this viewer): exclusives they can't open, and drops still in their early window.
 */
export function lockedPieces(summary: Summary | null, firstName: string, locale = "en-GB") {
  const pieces = new Map<string, { id: string; title: string; hint: string }>();
  for (const rule of summary?.locked_content ?? []) {
    if (rule.is_accessible) continue;
    pieces.set(rule.profile_block_id, { id: rule.profile_block_id, title: rule.teaser_title || "Exclusive", hint: fanUnlockHint(rule.access_level, firstName) });
  }
  for (const drop of summary?.drops ?? []) {
    if (drop.is_accessible || drop.status !== "early" || !drop.early_access_level || !drop.starts_at) continue;
    const out = new Date(drop.starts_at).toLocaleDateString(locale, { day: "numeric", month: "short" });
    pieces.set(drop.profile_block_id, { id: drop.profile_block_id, title: drop.title, hint: `Early access for ${FAN_AUDIENCE_LABEL[drop.early_access_level].toLowerCase()} · out ${out}` });
  }
  return [...pieces.values()];
}
