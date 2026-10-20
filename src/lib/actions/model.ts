/**
 * Creator Actions: the shared model for Collaboration requests, Giveaways, Bookings & applications and
 * Questions & fan submissions. The database (20261020140000_creator_actions.sql) is the source of truth
 * for validation, statuses and plan limits; this file mirrors it for forms and labels.
 */

export const ACTION_KINDS = ["collab", "giveaway", "booking", "submission"] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];
export const ACTION_STATUSES = ["draft", "published", "closed", "archived"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_KIND_NAME: Record<ActionKind, string> = {
  collab: "Collaboration requests",
  giveaway: "Giveaway",
  booking: "Bookings & applications",
  submission: "Questions & fan submissions",
};
export const ACTION_KIND_SHORT: Record<ActionKind, string> = { collab: "Collabs", giveaway: "Giveaway", booking: "Booking", submission: "Questions" };
export const ACTION_KIND_BLURB: Record<ActionKind, string> = {
  collab: "Brands and creators send a structured proposal.",
  giveaway: "People enter with a confirmed email. One entry each.",
  booking: "Requests for sessions, appearances or applications.",
  submission: "Questions, ideas and fan submissions, without opening your chat.",
};
export const ACTION_KIND_TINT: Record<ActionKind, string> = { collab: "#FFE7B8", giveaway: "#E6DCFF", booking: "#DCEBFF", submission: "#E8E2D4" };
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = { draft: "Draft", published: "Live", closed: "Closed", archived: "Archived" };

export const COLLAB_TYPES = ["campaign", "ugc", "commission", "licensing", "speaking", "other"] as const;
export type CollabType = (typeof COLLAB_TYPES)[number];
export const COLLAB_TYPE_LABEL: Record<CollabType, string> = { campaign: "Campaign", ugc: "UGC", commission: "Commission", licensing: "Licensing", speaking: "Speaking", other: "Something else" };
export const BUDGETS = ["under_1k", "1k_5k", "5k_10k", "10k_25k", "25k_plus", "unsure"] as const;
export type Budget = (typeof BUDGETS)[number];
export const BUDGET_LABEL: Record<Budget, string> = { under_1k: "< €1K", "1k_5k": "€1–5K", "5k_10k": "€5–10K", "10k_25k": "€10–25K", "25k_plus": "€25K+", unsure: "Not sure" };
/** Lower bound in euro cents, for the fit line against kit rates. */
export const BUDGET_FLOOR: Record<Budget, number | null> = { under_1k: 0, "1k_5k": 100_000, "5k_10k": 500_000, "10k_25k": 1_000_000, "25k_plus": 2_500_000, unsure: null };

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

export type SubmissionStatus = "new" | "reviewing" | "interested" | "accepted" | "answered" | "declined" | "completed" | "archived" | "spam" | "pending_verification" | "entered" | "disqualified";
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
  giveaway: ["pending_verification", "entered", "disqualified"],
};
export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  new: "New", reviewing: "Reviewing", interested: "Interested", accepted: "Accepted", answered: "Answered", declined: "Declined",
  completed: "Completed", archived: "Archived", spam: "Spam", pending_verification: "Unconfirmed", entered: "Entered", disqualified: "Disqualified",
};
export const SUBMISSION_STATUS_TONE: Partial<Record<SubmissionStatus, { bg: string; fg: string }>> = {
  new: { bg: "#FF5A4F", fg: "#0D0D0D" },
  reviewing: { bg: "#E6E4DC", fg: "#0D0D0D" },
  interested: { bg: "#B79CFF", fg: "#0D0D0D" },
  accepted: { bg: "#B79CFF", fg: "#0D0D0D" },
  answered: { bg: "#C7FF4A", fg: "#0D0D0D" },
  completed: { bg: "#C7FF4A", fg: "#0D0D0D" },
  entered: { bg: "#0D0D0D", fg: "#F5F4EF" },
  declined: { bg: "transparent", fg: "rgba(13,13,13,.55)" },
  spam: { bg: "transparent", fg: "rgba(13,13,13,.45)" },
  archived: { bg: "transparent", fg: "rgba(13,13,13,.55)" },
  disqualified: { bg: "transparent", fg: "rgba(13,13,13,.45)" },
  pending_verification: { bg: "transparent", fg: "rgba(13,13,13,.6)" },
};
/** Statuses that still need the creator. */
export const NEEDS_ATTENTION: SubmissionStatus[] = ["new"];

export const DEFAULT_CTA: Record<ActionKind, string> = { collab: "Send a proposal", giveaway: "Enter giveaway", booking: "Request", submission: "Send" };
export function ctaFor(action: Pick<PublicAction, "kind" | "cta_label" | "config">) {
  if (action.cta_label.trim()) return action.cta_label.trim();
  if (action.kind === "booking" && action.config.offering === "application") return "Apply";
  return DEFAULT_CTA[action.kind];
}

/** A new Action's starting point, so a creator edits instead of filling a blank form. */
export function starterAction(kind: ActionKind, firstName: string): Pick<ProfileAction, "kind" | "title" | "intro" | "cta_label" | "config"> {
  switch (kind) {
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
