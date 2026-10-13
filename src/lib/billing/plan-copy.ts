import { APPEARANCES, FREE_APPEARANCES, QR_STYLES, extraSlideLimit } from "@/components/profile/appearance";
import { FREE_NAME_FONTS, NAME_FONTS } from "@/components/profile/name-type";

import type { PlanCode } from "./catalog";
import { getPublicPlan } from "./catalog";

/**
 * Plan copy for Pricing and Billing. Every line maps to a live row in PLAN_MATRIX (or to the
 * Appearance limits that the database trigger mirrors); counts come from the same constants.
 * Rows that are still `future` in the matrix only appear under COMING_TO_PRO, marked as such.
 */
export const PLAN_COUNTS = {
  appearances: APPEARANCES.length,
  freeAppearances: FREE_APPEARANCES.length,
  nameFonts: NAME_FONTS.length,
  freeNameFonts: FREE_NAME_FONTS.length,
  qrStyles: QR_STYLES.length,
  plusSlides: extraSlideLimit("plus") + 1,
  proSlides: extraSlideLimit("pro") + 1,
  customRangeDays: 730,
} as const;

export type PlanHighlight = { text: string; strong?: boolean };

export const PLAN_HIGHLIGHTS: Readonly<Record<PlanCode, readonly PlanHighlight[]>> = {
  free: [
    { text: "Personal, Event and Business Modes" },
    { text: "Public profile, links, content and soundtrack" },
    { text: "QR, Quick QR, link sharing and Connect" },
    { text: "Connections, Guest Connect and private notes" },
    { text: "Passport, stamps and milestones" },
    { text: "Seven days of views, scans and Connections" },
    { text: "Immersive and Clean Appearances" },
  ],
  plus: [
    { text: "Plus member badge on your name", strong: true },
    { text: "No “Made with Setuvara” on your profile" },
    { text: `All ${PLAN_COUNTS.appearances} Appearances, name fonts and full controls` },
    { text: `${PLAN_COUNTS.qrStyles - 1} more QR styles` },
    { text: `Photo slideshow, ${PLAN_COUNTS.plusSlides} photos` },
    { text: "Member Passport finish and profile flair" },
    { text: "Premium soundtrack presentation" },
    { text: "Insights: 30 and 90 days, sources, Modes, conversion", strong: true },
  ],
  pro: [
    { text: "Pro member badge on your name", strong: true },
    { text: `Photo slideshow, ${PLAN_COUNTS.proSlides} photos` },
    { text: "Custom analytics ranges up to two years", strong: true },
    { text: "Connection journey funnel" },
    { text: "Device and Tap sharing insights" },
    { text: "Analytics export to CSV" },
  ],
};

/** Pro rows the matrix lists as `future`. Shown as coming, never as included. */
export const COMING_TO_PRO = [
  "Your own domain",
  "Advanced actions and lead capture",
  "Webhooks and integrations",
] as const;

export const PLAN_TAGLINES: Readonly<Record<PlanCode, string>> = {
  free: "Your identity, ready to share.",
  plus: "Premium identity and status.",
  pro: "Your identity, with the numbers.",
};

export function formatPrice(minor: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits,
  }).format(minor / 100);
}

/** "$5.75 a month, billed yearly. Save $14.88." straight from the catalog prices. */
export function yearlyNote(plan: "plus" | "pro") {
  const { monthlyPriceMinor, yearlyPriceMinor } = getPublicPlan(plan);
  const perMonth = Math.round(yearlyPriceMinor / 12);
  const saving = monthlyPriceMinor * 12 - yearlyPriceMinor;
  return `${formatPrice(perMonth)} a month, billed yearly. Save ${formatPrice(saving)}.`;
}

export function monthlyNote(plan: "plus" | "pro") {
  return `Or ${formatPrice(getPublicPlan(plan).yearlyPriceMinor)} a year, 2 months free.`;
}
