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
    { text: "Every Mode" },
    { text: "Profile, links, content and soundtrack" },
    { text: "QR, Quick QR and Connect" },
    { text: "Connections, notes and Passport" },
    { text: "7 days of insights" },
    { text: "Immersive and Clean" },
  ],
  plus: [
    { text: "Plus badge", strong: true },
    { text: `All ${PLAN_COUNTS.appearances} Appearances`, strong: true },
    { text: "Every name font and QR style" },
    { text: "No “Made with Setuvara”" },
    { text: `${PLAN_COUNTS.plusSlides}-photo slideshow` },
    { text: "Member Passport finish" },
    { text: "30 and 90 day insights" },
  ],
  pro: [
    { text: "Pro badge", strong: true },
    { text: "Any range, up to 2 years", strong: true },
    { text: `${PLAN_COUNTS.proSlides}-photo slideshow` },
    { text: "Connection journey" },
    { text: "Device and Tap insights" },
    { text: "CSV export" },
  ],
};

/** Pro rows the matrix lists as `future`. Shown as coming, never as included. */
export const COMING_TO_PRO = [
  "Your own domain",
  "Actions and lead capture",
  "Webhooks and integrations",
] as const;

export const PLAN_TAGLINES: Readonly<Record<PlanCode, string>> = {
  free: "Complete. Free for good.",
  plus: "Premium, and remembered.",
  pro: "Every number that matters.",
};

export function formatPrice(minor: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits,
  }).format(minor / 100);
}

/** "$5.75/mo billed yearly · save $14.88" straight from the catalog prices. */
export function yearlyNote(plan: "plus" | "pro") {
  const { monthlyPriceMinor, yearlyPriceMinor } = getPublicPlan(plan);
  const perMonth = Math.round(yearlyPriceMinor / 12);
  const saving = monthlyPriceMinor * 12 - yearlyPriceMinor;
  return `${formatPrice(perMonth)}/mo billed yearly · save ${formatPrice(saving)}`;
}

export function monthlyNote(plan: "plus" | "pro") {
  return `Or ${formatPrice(getPublicPlan(plan).yearlyPriceMinor)}/yr · 2 months free`;
}
