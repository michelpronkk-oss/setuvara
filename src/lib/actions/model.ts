/**
 * Actions: the shared model for Newsletters, Forms, Collaboration requests, Giveaways, Bookings &
 * applications and Questions & fan submissions, on any Mode. The database (20261020140000_creator_actions.sql,
 * 20261021130000_actions_all_modes.sql) is the source of truth for validation, statuses and plan limits;
 * this file mirrors it for forms and labels.
 */

import type { ModeSlug } from "@/components/profile/types";

export const ACTION_KINDS = ["newsletter", "form", "giveaway", "submission", "booking", "collab"] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];
export const ACTION_STATUSES = ["draft", "published", "closed", "archived"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_KIND_NAME: Record<ActionKind, string> = {
  newsletter: "Newsletter",
  form: "Form",
  collab: "Collaboration requests",
  giveaway: "Giveaway",
  booking: "Bookings & applications",
  submission: "Questions & fan submissions",
};
export const ACTION_KIND_SHORT: Record<ActionKind, string> = { newsletter: "Newsletter", form: "Form", collab: "Collabs", giveaway: "Giveaway", booking: "Booking", submission: "Questions" };
export const ACTION_KIND_BLURB: Record<ActionKind, string> = {
  newsletter: "Grow your list. Every signup is confirmed by email, one per address.",
  form: "Your own questions: sign-ups, RSVPs, leads or feedback.",
  collab: "Brands and creators send a structured proposal.",
  giveaway: "People enter with a confirmed email. One entry each.",
  booking: "Requests for sessions, appearances or applications.",
  submission: "Questions, ideas and fan submissions, without opening your chat.",
};
export const ACTION_KIND_TINT: Record<ActionKind, string> = { newsletter: "#C7FF4A", form: "#AFCBFF", collab: "#FFE7B8", giveaway: "#E6DCFF", booking: "#DCEBFF", submission: "#E8E2D4" };
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = { draft: "Draft", published: "Live", closed: "Closed", archived: "Archived" };

export const COLLAB_TYPES = ["campaign", "ugc", "commission", "licensing", "speaking", "other"] as const;
export type CollabType = (typeof COLLAB_TYPES)[number];
export const COLLAB_TYPE_LABEL: Record<CollabType, string> = { campaign: "Campaign", ugc: "UGC", commission: "Commission", licensing: "Licensing", speaking: "Speaking", other: "Something else" };
export const BUDGETS = ["under_1k", "1k_5k", "5k_10k", "10k_25k", "25k_plus", "unsure"] as const;
export type Budget = (typeof BUDGETS)[number];
export const BUDGET_LABEL: Record<Budget, string> = { under_1k: "< €1K", "1k_5k": "€1–5K", "5k_10k": "€5–10K", "10k_25k": "€10–25K", "25k_plus": "€25K+", unsure: "Not sure" };
/** Lower bound in euro cents, for the fit line against kit rates. */
export const BUDGET_FLOOR: Record<Budget, number | null> = { under_1k: 0, "1k_5k": 100_000, "5k_10k": 500_000, "10k_25k": 1_000_000, "25k_plus": 2_500_000, unsure: null };

/** Kinds whose people confirm by email before they count. */
export const CONFIRMED_KINDS: readonly ActionKind[] = ["giveaway", "newsletter"];
export const isConfirmedKind = (kind: ActionKind) => CONFIRMED_KINDS.includes(kind);

/** The kinds that suit a Mode best, first in its picker. Every kind works on every Mode. */
export const MODE_KIND_ORDER: Record<ModeSlug, ActionKind[]> = {
  personal: ["newsletter", "form", "submission", "giveaway", "booking", "collab"],
  event: ["form", "newsletter", "giveaway", "submission", "booking", "collab"],
  business: ["form", "booking", "newsletter", "submission", "collab", "giveaway"],
  creator: ["collab", "giveaway", "newsletter", "submission", "booking", "form"],
};

export type Question = { id: string; label: string; type: "short" | "long" | "choice"; options?: string[]; required?: boolean };
export type ActionConfig = {
  questions?: Question[];
  // collab
  types?: CollabType[];
  askBudget?: boolean;
  askTimeline?: boolean;
  askWebsite?: boolean;
  availability?: string;
  // giveaway
  prize?: string;
  eligibility?: string;
  rules?: string;
  sponsor?: string;
  minAge?: 13 | 16 | 18 | 21;
  // booking
  offering?: "booking" | "application";
  details?: string;
  priceNote?: string;
  askDates?: boolean;
  // submission
  prompt?: string;
  allowAnonymous?: boolean;
  askFeatureConsent?: boolean;
  emailRequired?: boolean;
  // newsletter
  promise?: string;
  frequency?: string;
  sender?: string;
  // newsletter, form
  askName?: boolean;
  // every kind: the line on the success screen
  thanks?: string;
};

export type ProfileAction = {
  id: string;
  mode_id: string;
  kind: ActionKind;
  status: ActionStatus;
  title: string;
  intro: string;
  cta_label: string;
  cover_block_id: string | null;
  config: ActionConfig;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type PublicAction = Pick<ProfileAction, "id" | "kind" | "title" | "intro" | "cta_label" | "cover_block_id" | "config" | "starts_at" | "ends_at">;

export type SubmissionStatus = "new" | "reviewing" | "interested" | "accepted" | "answered" | "declined" | "completed" | "archived" | "spam" | "pending_verification" | "entered" | "disqualified" | "subscribed" | "unsubscribed";
export type Submission = {
  id: string;
  action_id: string;
  kind: ActionKind;
  submitter_user_id: string | null;
  name: string;
  email: string | null;
  answers: Record<string, string>;
  status: SubmissionStatus;
  feature_consent: boolean;
  verified_at: string | null;
  created_at: string;
};
export const SUBMISSION_COLUMNS = "id, action_id, kind, submitter_user_id, name, email, answers, status, feature_consent, verified_at, created_at";

/** The statuses a creator moves each kind through, in order; the last ones are side exits. */
export const STATUS_FLOW: Record<ActionKind, SubmissionStatus[]> = {
  collab: ["new", "reviewing", "interested", "completed", "declined", "spam"],
  booking: ["new", "reviewing", "accepted", "completed", "declined", "spam"],
  submission: ["new", "reviewing", "answered", "archived", "spam"],
  form: ["new", "reviewing", "answered", "archived", "spam"],
  giveaway: ["pending_verification", "entered", "disqualified"],
  newsletter: ["pending_verification", "subscribed", "unsubscribed"],
};
export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  new: "New", reviewing: "Reviewing", interested: "Interested", accepted: "Accepted", answered: "Answered", declined: "Declined",
  completed: "Completed", archived: "Archived", spam: "Spam", pending_verification: "Unconfirmed", entered: "Entered", disqualified: "Disqualified",
  subscribed: "Subscribed", unsubscribed: "Removed",
};
export const SUBMISSION_STATUS_TONE: Partial<Record<SubmissionStatus, { bg: string; fg: string }>> = {
  new: { bg: "#FF5A4F", fg: "#0D0D0D" },
  reviewing: { bg: "#E6E4DC", fg: "#0D0D0D" },
  interested: { bg: "#B79CFF", fg: "#0D0D0D" },
  accepted: { bg: "#B79CFF", fg: "#0D0D0D" },
  answered: { bg: "#C7FF4A", fg: "#0D0D0D" },
  completed: { bg: "#C7FF4A", fg: "#0D0D0D" },
  entered: { bg: "#0D0D0D", fg: "#F5F4EF" },
  subscribed: { bg: "#0D0D0D", fg: "#F5F4EF" },
  unsubscribed: { bg: "transparent", fg: "rgba(13,13,13,.45)" },
  declined: { bg: "transparent", fg: "rgba(13,13,13,.55)" },
  spam: { bg: "transparent", fg: "rgba(13,13,13,.45)" },
  archived: { bg: "transparent", fg: "rgba(13,13,13,.55)" },
  disqualified: { bg: "transparent", fg: "rgba(13,13,13,.45)" },
  pending_verification: { bg: "transparent", fg: "rgba(13,13,13,.6)" },
};
/** Statuses that still need the creator. */
export const NEEDS_ATTENTION: SubmissionStatus[] = ["new"];

export const DEFAULT_CTA: Record<ActionKind, string> = { newsletter: "Subscribe", form: "Send", collab: "Send a proposal", giveaway: "Enter giveaway", booking: "Request", submission: "Send" };
export function ctaFor(action: Pick<PublicAction, "kind" | "cta_label" | "config">) {
  if (action.cta_label.trim()) return action.cta_label.trim();
  if (action.kind === "booking" && action.config.offering === "application") return "Apply";
  return DEFAULT_CTA[action.kind];
}

/** A new Action's starting point, so the owner edits instead of filling a blank form. */
export function starterAction(kind: ActionKind, firstName: string, mode: ModeSlug = "creator"): Pick<ProfileAction, "kind" | "title" | "intro" | "cta_label" | "config"> {
  switch (kind) {
    case "newsletter":
      return mode === "business"
        ? { kind, title: "Get the update", intro: "What we're building, once a month. Unsubscribe any time.", cta_label: "", config: { promise: "Product news and one useful idea", frequency: "Monthly", askName: true } }
        : mode === "event"
          ? { kind, title: "Stay in the loop", intro: "Notes and photos from the event, and what comes next.", cta_label: "", config: { promise: "The recap and what's next", frequency: "After each event", askName: true } }
          : { kind, title: `Letters from ${firstName}`, intro: "What I'm making, reading and thinking about. Straight to your inbox.", cta_label: "", config: { promise: "New work and small notes", frequency: "Monthly", askName: true } };
    case "form":
      return mode === "event"
        ? { kind, title: "Join us", intro: "Save your spot. I'll send the details by email.", cta_label: "Count me in", config: { askName: true, emailRequired: true, questions: [{ id: "q1", label: "Are you coming?", type: "choice", options: ["Yes", "Maybe"], required: true }] } }
        : mode === "business"
          ? { kind, title: "Tell us what you need", intro: "A few questions so we can come back with something useful.", cta_label: "", config: { askName: true, emailRequired: true, questions: [{ id: "q1", label: "Company", type: "short" }, { id: "q2", label: "What do you need?", type: "long", required: true }] } }
          : { kind, title: "Say hello", intro: "Questions, plans or ideas. I read everything.", cta_label: "", config: { askName: true, emailRequired: false, questions: [{ id: "q1", label: "What's on your mind?", type: "long", required: true }] } };
    case "collab":
      return { kind, title: `Work with ${firstName}`, intro: "Campaigns, commissions and licensing for brands that care how things look.", cta_label: "", config: { types: ["campaign", "ugc", "commission", "licensing"], askBudget: true, askTimeline: true, askWebsite: true } };
    case "giveaway":
      return { kind, title: "Win a gaming headset", intro: "Enter for a chance to win. One entry per person. No purchase necessary.", cta_label: "", config: { prize: "", eligibility: "", rules: "", sponsor: firstName, minAge: 18 } };
    case "booking":
      return { kind, title: "Book a session", intro: "Tell me what you have in mind and when. I reply to every request.", cta_label: "", config: { offering: "booking", details: "", priceNote: "", askDates: true } };
    case "submission":
      return { kind, title: "Ask me anything", intro: "Questions, ideas and things you want to see next.", cta_label: "", config: { prompt: "What should I make next?", allowAnonymous: true, askFeatureConsent: true } };
  }
}

/** Open, upcoming or ended, from the dates alone. */
export function actionWindow(action: Pick<PublicAction, "starts_at" | "ends_at">, now = Date.now()) {
  if (action.starts_at && new Date(action.starts_at).getTime() > now) return "upcoming" as const;
  if (action.ends_at && new Date(action.ends_at).getTime() <= now) return "ended" as const;
  return "open" as const;
}

/** Mirrors the database's email key for duplicate giveaway entries. It is a duplicate guard, not identity. */
export function normalizeEmail(email: string) {
  const value = email.trim().toLowerCase();
  const [local = "", domain = ""] = value.split("@");
  let name = local.split("+")[0];
  let host = domain;
  if (host === "gmail.com" || host === "googlemail.com") { name = name.replaceAll(".", ""); host = "gmail.com"; }
  return `${name}@${host}`;
}

export type ActionLimits = { plan: "free" | "plus" | "pro"; published_actions: number; open_giveaways: number; custom_questions: number; can_export: boolean };
/** Defaults the migration installs; the database row wins when it is read. */
export const DEFAULT_LIMITS: Record<ActionLimits["plan"], ActionLimits> = {
  free: { plan: "free", published_actions: 2, open_giveaways: 0, custom_questions: 3, can_export: false },
  plus: { plan: "plus", published_actions: 8, open_giveaways: 1, custom_questions: 6, can_export: true },
  pro: { plan: "pro", published_actions: 24, open_giveaways: 5, custom_questions: 12, can_export: true },
};

/** Friendly copy for database refusals. */
export const ACTION_ERRORS: Record<string, string> = {
  plan_action_limit: "Your plan's live Action limit is reached. Close one or upgrade.",
  plan_giveaway_limit: "Giveaways come with Plus. Your plan's open giveaway limit is reached.",
  plan_question_limit: "Your plan allows fewer custom questions.",
  action_config_invalid: "Some settings aren't valid. Check the fields and try again.",
  giveaway_terms_locked: "People have entered, so the giveaway's terms and dates can't change.",
  giveaway_already_ended: "Set an end date in the future before publishing.",
  action_cover_invalid: "Pick a picture from this Mode for the cover.",
};
export function actionErrorMessage(message: string | undefined) {
  for (const [key, copy] of Object.entries(ACTION_ERRORS)) if (message?.includes(key)) return copy;
  if (message?.includes("check constraint")) return "Check the dates: a giveaway needs an end date after its start.";
  return "That didn't save. Try again.";
}
