import { MILESTONES, PASSPORT_REWARDS, type PassportReward, type RewardCategory } from "./rewards";

/** Pure Passport presentation helpers. Every value is derived from get_passport_overview; nothing is invented. */

export type PassportStampType = "milestone" | "event" | "city" | "country";
export type MilestoneRecord = { threshold: number; unlockedAt: string; seenAt: string | null };
export type PassportStampRecord = {
  id: string;
  type: PassportStampType;
  key?: string;
  title: string;
  subtitle: string | null;
  countryCode: string | null;
  earnedAt: string;
};
export type CoverId = "standard" | "paper_passport_cover" | "century_cover" | "thousand_cover";
export type CoverLook = "standard" | "paper" | "century" | "thousand";
export type StampState = "earned" | "progress" | "locked";

export const COVERS: readonly { id: CoverId; look: CoverLook; name: string; short: string; how: string; at: number }[] = [
  { id: "standard", look: "standard", name: "Standard", short: "Standard", how: "EVERY PASSPORT", at: 0 },
  { id: "paper_passport_cover", look: "paper", name: "Paper Passport", short: "Paper", how: "EARNED AT 5 · FIRST CIRCLE", at: 5 },
  { id: "century_cover", look: "century", name: "Century Cover", short: "Century", how: "EARNED AT 100 · CENTURY", at: 100 },
  { id: "thousand_cover", look: "thousand", name: "Thousand Cover", short: "Thousand", how: "EARNED AT 1000 · THOUSAND MET", at: 1000 },
];

export function coverFor(id: string | null | undefined) {
  return COVERS.find((cover) => cover.id === id) ?? COVERS[0];
}

const UTC = "UTC";
const validDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

/** "OCT 2026" */
export function monthMark(value: string | null | undefined) {
  const date = validDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: UTC }).format(date).toUpperCase();
}

/** "March 2025" */
export function monthLong(value: string | null | undefined) {
  const date = validDate(value);
  return date ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: UTC }).format(date) : "";
}

/** "10 Oct 2026" */
export function dayMark(value: string | null | undefined) {
  const date = validDate(value);
  return date ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: UTC }).format(date) : "";
}

/** "OCTOBER 10, 2026" */
export function earnedLong(value: string | null | undefined) {
  const date = validDate(value);
  return date ? new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: UTC }).format(date).toUpperCase() : "";
}

/** "10 · OCT · 2026" */
export function pageDate(value: string | null | undefined) {
  const date = validDate(value);
  if (!date) return "";
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en", { ...options, timeZone: UTC }).format(date);
  return `${part({ day: "numeric" })} · ${part({ month: "short" }).toUpperCase()} · ${part({ year: "numeric" })}`;
}

const yearOf = (value: string | null | undefined) => validDate(value)?.getUTCFullYear().toString() ?? "";

export function milestoneTier(threshold: number): 1 | 2 | 3 | 4 {
  return threshold >= 1000 ? 4 : threshold >= 250 ? 3 : threshold >= 50 ? 2 : 1;
}

export function milestoneIndex(threshold: number) {
  return MILESTONES.findIndex((milestone) => milestone.threshold === threshold);
}

export function milestoneName(threshold: number) {
  return MILESTONES.find((milestone) => milestone.threshold === threshold)?.name ?? `${threshold} Connections`;
}

/** "05 OF 08" */
export function ordinalOf(threshold: number) {
  const index = milestoneIndex(threshold);
  return `${String(index + 1).padStart(2, "0")} OF ${String(MILESTONES.length).padStart(2, "0")}`;
}

/** Threshold of a milestone stamp: its context key, else its title or subtitle. */
export function stampThreshold(stamp: Pick<PassportStampRecord, "type" | "key" | "title" | "subtitle">) {
  if (stamp.type !== "milestone") return null;
  const fromKey = Number(stamp.key);
  if (Number.isInteger(fromKey) && fromKey > 0) return fromKey;
  const byName = MILESTONES.find((milestone) => milestone.name === stamp.title);
  if (byName) return byName.threshold;
  const fromSubtitle = Number(stamp.subtitle?.match(/\d+/)?.[0]);
  return Number.isInteger(fromSubtitle) && fromSubtitle > 0 ? fromSubtitle : null;
}

/** Stable press angle per stamp: −8° … +6°. */
export function stampRotation(key: string) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 15) - 8;
}

/** Visual-only serial for the cover's serial slot. Derived from the handle; not a record field. */
export function coverSerial(handle: string) {
  let hash = 2166136261;
  for (let index = 0; index < handle.length; index += 1) {
    hash ^= handle.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const digits = String(Math.abs(hash) % 100_000_000).padStart(8, "0");
  return `Nº ${digits.slice(0, 4)} ${digits.slice(4)}`;
}

export function countryName(code: string, language = "en") {
  const upper = code.toUpperCase();
  try { return new Intl.DisplayNames([language], { type: "region" }).of(upper) ?? upper; }
  catch { return upper; }
}

/** City part of an event/city subtitle ("Amsterdam, NL · 2026" → "Amsterdam"). */
function placeOf(subtitle: string | null) {
  const head = (subtitle ?? "").split(" · ")[0]?.trim() ?? "";
  if (/^\d{4}$/.test(head)) return "";
  const city = head.split(",")[0]?.trim() ?? "";
  return /^[A-Z]{2}$/.test(city) ? "" : city;
}

/** The small mono line printed on the stamp itself. */
export function stampSub(stamp: PassportStampRecord) {
  const year = yearOf(stamp.earnedAt) || (stamp.subtitle?.match(/\d{4}/)?.[0] ?? "");
  if (stamp.type === "milestone") return monthMark(stamp.earnedAt);
  if (stamp.type === "event") {
    const place = placeOf(stamp.subtitle);
    return [place.toLocaleUpperCase("en"), year].filter(Boolean).join(" · ");
  }
  return year;
}

/** Name under a stamp in grids and sheets. */
export function stampLabel(stamp: Pick<PassportStampRecord, "type" | "title" | "countryCode">, language = "en") {
  if (stamp.type === "country") return countryName(stamp.countryCode ?? stamp.title, language);
  return stamp.title;
}

/** Mono meta under a stamp label. */
export function stampMeta(stamp: PassportStampRecord) {
  if (stamp.type === "milestone") {
    const threshold = stampThreshold(stamp);
    return threshold ? `${threshold} ${threshold === 1 ? "CONNECTION" : "CONNECTIONS"}` : "MILESTONE";
  }
  if (stamp.type === "city") return stamp.countryCode ? `CITY · ${stamp.countryCode}` : "CITY";
  return stamp.type === "event" ? "EVENT" : "COUNTRY";
}

/** Context line for a place stamp ("Amsterdam · 2026"). */
export function placeContext(stamp: PassportStampRecord, language = "en") {
  const year = yearOf(stamp.earnedAt);
  if (stamp.type === "city") return [stamp.countryCode ? countryName(stamp.countryCode, language) : "", year].filter(Boolean).join(" · ");
  if (stamp.type === "event") {
    const place = placeOf(stamp.subtitle);
    return [place, stamp.countryCode ? countryName(stamp.countryCode, language) : "", year].filter(Boolean).join(" · ");
  }
  return year;
}

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
/** NEW until the milestone is seen, or for 7 days for place stamps. */
export function isNewStamp(stamp: PassportStampRecord, milestones: MilestoneRecord[], now = Date.now()) {
  if (stamp.type === "milestone") {
    const threshold = stampThreshold(stamp);
    const record = milestones.find((item) => item.threshold === threshold);
    if (record) return !record.seenAt;
  }
  const earned = validDate(stamp.earnedAt)?.getTime();
  return earned != null && now - earned >= 0 && now - earned < SEVEN_DAYS;
}

export function nextMilestone(count: number) {
  return MILESTONES.find((milestone) => milestone.threshold > count) ?? null;
}

/** The printed line: eight ordinal markers (i / 7) and a fill interpolated inside the active segment. */
export function milestoneRuler(count: number) {
  const thresholds = MILESTONES.map((milestone) => milestone.threshold);
  const nextIndex = thresholds.findIndex((threshold) => threshold > count);
  const last = thresholds.length - 1;
  let position: number;
  if (nextIndex === -1) position = last;
  else if (nextIndex === 0) position = 0;
  else position = (nextIndex - 1) + (count - thresholds[nextIndex - 1]) / (thresholds[nextIndex] - thresholds[nextIndex - 1]);
  const markers = thresholds.map((threshold, index) => ({
    threshold,
    x: (index / last) * 100,
    state: (threshold <= count ? "earned" : index === nextIndex ? "next" : "future") as "earned" | "next" | "future",
  }));
  return { markers, fill: (position / last) * 100 };
}

const REWARD_KIND: Record<RewardCategory, string> = {
  profile_treatment: "profile",
  accent: "accent",
  share_treatment: "share",
  qr_frame: "QR",
  passport_cover: "cover",
  passport_stamp_style: "stamp",
  profile_mark: "profile mark",
};

export function rewardKind(reward: PassportReward) {
  return REWARD_KIND[reward.category];
}

/** Rewards a milestone unlocks that can be worn (stamp styles are the stamp itself). */
export function wearableRewards(threshold: number) {
  return PASSPORT_REWARDS.filter((reward) => reward.milestone === threshold && reward.category !== "passport_stamp_style");
}

function rewardPhrase(reward: PassportReward) {
  if (reward.category === "profile_treatment" && !/profile/i.test(reward.name)) return `${reward.name} profile`;
  if (reward.category === "profile_mark") return `${reward.name} profile mark`;
  return reward.name;
}

function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** "Unlocks the Century Cover and Century Profile." */
export function unlocksSentence(threshold: number) {
  const names = wearableRewards(threshold).filter((reward) => reward.category !== "share_treatment" && reward.category !== "accent").map(rewardPhrase);
  return names.length ? `Unlocks the ${joinList(names)}.` : "";
}

/** "the Connector profile" (short form for the desktop line). */
export function unlocksShort(threshold: number) {
  const first = wearableRewards(threshold).find((reward) => reward.category !== "share_treatment" && reward.category !== "accent");
  return first ? `unlocks the ${rewardPhrase(first)}` : "";
}

/** "Also unlocked: Signal 50 profile mark and Coral Frame. They're yours to wear." */
export function alsoUnlocked(threshold: number) {
  const names = wearableRewards(threshold).map(rewardPhrase);
  return names.length ? `Also unlocked: ${joinList(names)}. ${names.length === 1 ? "It's" : "They're"} yours to wear.` : "";
}

const plural = (count: number, one: string, many: string) => `${count.toLocaleString("en")} ${count === 1 ? one : many}`;

/** "4 milestones, 3 cities, 2 events and 2 countries in your Passport since March 2025." */
export function summarySentence(input: { milestones: number; cities: number; events: number; countries: number; since: string | null }, withPassport = true) {
  const parts = [
    input.milestones ? plural(input.milestones, "milestone", "milestones") : "",
    input.cities ? plural(input.cities, "city", "cities") : "",
    input.events ? plural(input.events, "event", "events") : "",
    input.countries ? plural(input.countries, "country", "countries") : "",
  ].filter(Boolean);
  const since = monthLong(input.since);
  if (!parts.length) return since ? `Your Passport, kept since ${since}.` : "Your Passport, kept.";
  return `${joinList(parts)}${withPassport ? " in your Passport" : ""}${since ? ` since ${since}` : ""}.`;
}

export type CollectionItem =
  | { kind: "stamp"; stamp: PassportStampRecord }
  | { kind: "ahead"; threshold: number; state: "progress" | "locked" };

/** Earned stamps (earnedAt desc), then the next milestone (progress) and the one after (locked). No further. */
export function aheadMilestones(count: number): CollectionItem[] {
  const index = MILESTONES.findIndex((milestone) => milestone.threshold > count);
  if (index === -1) return [];
  return MILESTONES.slice(index, index + 2).map((milestone, offset) => ({ kind: "ahead" as const, threshold: milestone.threshold, state: offset === 0 ? "progress" as const : "locked" as const }));
}

export type StampFilter = "all" | PassportStampType;

export function collectionItems(stamps: PassportStampRecord[], count: number, filter: StampFilter): CollectionItem[] {
  const earned = (filter === "all" ? stamps : stamps.filter((stamp) => stamp.type === filter)).map((stamp) => ({ kind: "stamp" as const, stamp }));
  return filter === "all" || filter === "milestone" ? [...earned, ...aheadMilestones(count)] : earned;
}

export type JourneyMonth = { key: string; month: string; head: string; line: string; stamps: PassportStampRecord[] };

/** Stamps grouped by the month they were earned, newest first. Ends with the month the Passport was issued. */
export function journeyMonths(stamps: PassportStampRecord[], since: string | null, language = "en"): JourneyMonth[] {
  const months: JourneyMonth[] = [];
  for (const stamp of stamps) {
    const date = validDate(stamp.earnedAt);
    const key = date ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}` : "unknown";
    let month = months.find((item) => item.key === key);
    if (!month) { month = { key, month: date ? monthMark(stamp.earnedAt) : "RECORDED", head: "", line: "", stamps: [] }; months.push(month); }
    month.stamps.push(stamp);
  }
  months.sort((a, b) => b.key.localeCompare(a.key));
  for (const month of months) {
    month.stamps.sort((a, b) => order(a) - order(b));
    const places = month.stamps.filter((stamp) => stamp.type === "city" || stamp.type === "event").map((stamp) => stamp.title);
    const milestone = month.stamps.find((stamp) => stamp.type === "milestone");
    const country = month.stamps.find((stamp) => stamp.type === "country");
    month.head = places.length ? (places.length > 3 ? `${places.slice(0, 3).join(" · ")} +${places.length - 3}` : places.join(" · ")) : milestone ? milestone.title : country ? stampLabel(country, language) : "";
    month.line = [milestone ? `${milestone.title} earned` : "", country ? stampLabel(country, language) : ""].filter(Boolean).join(" · ")
      || plural(month.stamps.length, "stamp", "stamps");
  }
  if (since && validDate(since)) months.push({ key: "issued", month: monthMark(since), head: "Passport issued", line: "Where it started.", stamps: [] });
  return months;
}

const TYPE_ORDER: Record<PassportStampType, number> = { milestone: 0, city: 1, event: 2, country: 3 };
const order = (stamp: PassportStampRecord) => TYPE_ORDER[stamp.type];

export function filterCounts(stamps: PassportStampRecord[], total: number) {
  return {
    all: total,
    milestone: stamps.filter((stamp) => stamp.type === "milestone").length,
    city: stamps.filter((stamp) => stamp.type === "city").length,
    event: stamps.filter((stamp) => stamp.type === "event").length,
    country: stamps.filter((stamp) => stamp.type === "country").length,
  } satisfies Record<StampFilter, number>;
}
