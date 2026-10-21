import type { ModeSlug } from "@/components/profile/types";
import type { ActionConfig, ActionKind, Question } from "@/lib/actions/model";

/**
 * Premium Action Templates ("goals"). A goal is a configuration of what Setuvara already does:
 * the owner says what they want, answers a few questions, and gets ordinary drafts (Actions, an
 * Event, a product) they can edit and publish. Nothing here invents a feature; every line of copy
 * describes something the created records really do.
 */

export const GOAL_IDS = [
  "meet_connect", "ask_me_anything", "grow_network",
  "get_more_clients", "book_consultation", "collect_feedback",
  "grow_audience", "launch_product", "reward_fans",
  "host_event", "grow_attendance", "after_event",
] as const;
export type GoalId = (typeof GOAL_IDS)[number];
export const isGoalId = (value: unknown): value is GoalId => GOAL_IDS.includes(value as GoalId);

export type GoalField =
  | { id: string; type: "text"; label: string; placeholder?: string; max: number; required?: boolean; hint?: string }
  | { id: string; type: "choice"; label: string; options: { value: string; label: string }[]; hint?: string }
  | { id: string; type: "datetime"; label: string; hint?: string }
  | { id: string; type: "number"; label: string; min: number; max: number; placeholder?: string; hint?: string }
  | { id: string; type: "money"; label: string; hint?: string };
export type GoalAnswers = Record<string, string>;

export type GoalActionDraft = { kind: ActionKind; title: string; intro: string; cta_label: string | null; config: ActionConfig; starts_at: string | null; ends_at: string | null; thanks_heading: string };
export type GoalEventDraft = { title: string; summary: string; starts_at: string; ends_at: string; timezone: string; venue_name: string; city: string; capacity: number | null; waitlist_enabled: boolean };
export type GoalOfferDraft = { offer_type: "digital" | "service"; title: string; description: string; currency: "EUR" | "USD" | "GBP"; unit_amount_minor: number };
export type GoalPlan = { actions: GoalActionDraft[]; event: GoalEventDraft | null; offer: GoalOfferDraft | null };

export type GoalContext = { firstName: string; now: number; timezone: string };

export type Goal = {
  id: GoalId;
  mode: ModeSlug;
  name: string;
  promise: string;
  /** One line per thing created, shown before applying. */
  creates: (answers: GoalAnswers) => string[];
  fields: GoalField[];
  defaults: (ctx: GoalContext) => GoalAnswers;
  build: (answers: GoalAnswers, ctx: GoalContext) => GoalPlan;
  /** What to do after applying, in the owner's words. */
  next: string;
  free: boolean;
};

const clip = (value: string | undefined, max: number) => (value ?? "").trim().slice(0, max);
const q = (id: string, label: string, type: Question["type"], options?: string[], required = false): Question => ({ id, label, type, ...(options ? { options } : {}), required });
const action = (kind: ActionKind, title: string, intro: string, config: ActionConfig, thanks: string, cta: string | null = null, window: { starts_at?: string | null; ends_at?: string | null } = {}): GoalActionDraft =>
  ({ kind, title: clip(title, 80), intro: clip(intro, 280), cta_label: cta, config, starts_at: window.starts_at ?? null, ends_at: window.ends_at ?? null, thanks_heading: clip(thanks, 60) });
const plan = (actions: GoalActionDraft[], extra: Partial<GoalPlan> = {}): GoalPlan => ({ actions, event: null, offer: null, ...extra });

const day = 86_400_000;
const atHour = (ms: number, hour: number) => { const d = new Date(ms); d.setUTCHours(hour, 0, 0, 0); return d.getTime(); };
export const defaultEventStart = (now: number) => new Date(atHour(now + 21 * day, 17)).toISOString().slice(0, 16);
/** Parses the editor's local "YYYY-MM-DDTHH:mm" as UTC wall time; the event keeps its own time zone. */
export function parseLocal(value: string | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}:00Z`);
  return Number.isFinite(ms) ? ms : null;
}
/** "24" or "24,50" in major units → minor units, or null. */
export function parseMajor(value: string | undefined): number | null {
  const clean = (value ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
  if (!clean) return null;
  const minor = Math.round(Number(clean) * 100);
  return Number.isSafeInteger(minor) && minor >= 0 && minor <= 10_000_000 ? minor : null;
}

const CURRENCY_OPTIONS = [{ value: "EUR", label: "€" }, { value: "USD", label: "$" }, { value: "GBP", label: "£" }];

export const GOALS: Record<GoalId, Goal> = {
  // ------------------------------------------------------------------ Personal
  meet_connect: {
    id: "meet_connect", mode: "personal", name: "Meet & Connect", free: true,
    promise: "Turn a scan or tap into a real contact you can follow up with.",
    fields: [
      { id: "context", type: "text", label: "Where do people usually meet you?", placeholder: "Conferences, meetups, my studio", max: 60 },
      { id: "followUp", type: "choice", label: "What do you want to know about them?", options: [{ value: "work", label: "What they do" }, { value: "why", label: "Why we should talk" }, { value: "none", label: "Just name and email" }] },
    ],
    defaults: () => ({ context: "", followUp: "work" }),
    creates: () => ["A “Stay in touch” form on Personal Mode, as a draft", "People who fill it in land in your Responses"],
    build: (a, ctx) => plan([action("form", "Stay in touch", `Good to meet you${a.context ? ` at ${clip(a.context, 60)}` : ""}. Leave your details and ${ctx.firstName || "I"} will follow up.`,
      { askName: true, emailRequired: true, questions: a.followUp === "none" ? [] : [q("q1", a.followUp === "why" ? "What should we talk about?" : "What do you do?", "short")], thanks: "Thanks. Talk soon." },
      "Thanks, I'll be in touch", "Send my details")]),
    next: "Publish the form, then share your Personal Mode QR or tap card where you meet people.",
  },
  ask_me_anything: {
    id: "ask_me_anything", mode: "personal", name: "Ask Me Anything", free: false,
    promise: "Collect questions in one place and answer the best ones.",
    fields: [
      { id: "topic", type: "text", label: "What can people ask about?", placeholder: "Design careers, moving abroad", max: 80, required: true },
      { id: "anonymous", type: "choice", label: "Allow anonymous questions?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No, ask for a name" }] },
    ],
    defaults: () => ({ topic: "", anonymous: "yes" }),
    creates: (a) => [`A questions page about ${clip(a.topic, 80) || "your topic"}, as a draft`, "Questions arrive in Responses, private until you answer"],
    build: (a) => plan([action("submission", `Ask me about ${clip(a.topic, 60) || "anything"}`, "Send a question. I read every one and answer the best ones.",
      { prompt: `What would you like to know about ${clip(a.topic, 80) || "this"}?`, allowAnonymous: a.anonymous !== "no", emailRequired: false, thanks: "Got it. Watch this space." }, "Question received")]),
    next: "Publish it and pin the link where your audience already follows you.",
  },
  grow_network: {
    id: "grow_network", mode: "personal", name: "Grow My Network", free: false,
    promise: "Let people request an introduction or a short call, with context up front.",
    fields: [
      { id: "openTo", type: "choice", label: "What are you open to?", options: [{ value: "intros", label: "Introductions" }, { value: "coffee", label: "Coffee chats" }, { value: "mentoring", label: "Mentoring" }] },
      { id: "field", type: "text", label: "Your field, in a few words", placeholder: "Product design", max: 60 },
    ],
    defaults: () => ({ openTo: "intros", field: "" }),
    creates: () => ["A contact request form on Personal Mode, as a draft", "Requests arrive in Responses with the context you asked for"],
    build: (a) => {
      const what = a.openTo === "coffee" ? "a coffee chat" : a.openTo === "mentoring" ? "mentoring" : "an introduction";
      return plan([action("form", `Ask for ${what}`, `I'm open to ${what}${a.field ? ` in ${clip(a.field, 60)}` : ""}. Tell me a little about you.`,
        { askName: true, emailRequired: true, questions: [q("q1", "Who are you, in a line?", "short", undefined, true), q("q2", "What would you like from it?", "long")], thanks: "Thanks. I reply to every request." }, "Request sent")]);
    },
    next: "Publish it and add it to your Personal Mode, near your links.",
  },

  // ------------------------------------------------------------------ Business
  get_more_clients: {
    id: "get_more_clients", mode: "business", name: "Get More Clients", free: true,
    promise: "A qualifying inquiry form that sends every lead to your Lead Inbox.",
    fields: [
      { id: "service", type: "text", label: "What do clients hire you for?", placeholder: "Brand identity, kitchen renovations", max: 80, required: true },
      { id: "budget", type: "choice", label: "Ask for a budget range?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
      { id: "timeline", type: "choice", label: "Ask when they want to start?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
    ],
    defaults: () => ({ service: "", budget: "yes", timeline: "yes" }),
    creates: (a) => [`An inquiry form for ${clip(a.service, 80) || "your service"}, as a draft`, "Every inquiry becomes a lead in your Lead Inbox, ready to qualify"],
    build: (a) => {
      const questions: Question[] = [q("q1", "What do you need?", "long", undefined, true)];
      if (a.budget !== "no") questions.push(q("q2", "Budget", "choice", ["Under €1,000", "€1,000–5,000", "€5,000–20,000", "€20,000+", "Not sure yet"]));
      if (a.timeline !== "no") questions.push(q("q3", "When would you like to start?", "choice", ["As soon as possible", "Within a month", "In 1–3 months", "Just exploring"]));
      return plan([action("form", `Work with us: ${clip(a.service, 60) || "get a quote"}`, "Tell us about your project. We reply within two working days.",
        { askName: true, emailRequired: true, questions, thanks: "Thanks. We'll be in touch shortly." }, "Inquiry received", "Send inquiry")]);
    },
    next: "Publish the form. New inquiries show up in Business → Leads.",
  },
  book_consultation: {
    id: "book_consultation", mode: "business", name: "Book a Consultation", free: false,
    promise: "Take consultation requests with intake questions, then confirm a time yourself.",
    fields: [
      { id: "service", type: "text", label: "What is the consultation for?", placeholder: "A 30-minute strategy call", max: 80, required: true },
      { id: "price", type: "text", label: "Price note (optional)", placeholder: "Free · €90 · From €150", max: 40 },
      { id: "intake", type: "text", label: "One thing you need to know first", placeholder: "What's your current setup?", max: 120 },
    ],
    defaults: () => ({ service: "", price: "", intake: "" }),
    creates: (a) => [`A booking request page for ${clip(a.service, 80) || "your consultation"}, as a draft`, "Requests arrive as leads; you reply to confirm a time"],
    build: (a) => plan([action("booking", `Book ${clip(a.service, 60) || "a consultation"}`, "Request a time and share a little context. I'll confirm by email.",
      { offering: "booking", details: clip(a.service, 300), priceNote: clip(a.price, 40) || undefined, askDates: true, questions: a.intake ? [q("q1", clip(a.intake, 120), "long")] : [], thanks: "Request received. I'll confirm a time by email." }, "Request sent")]),
    next: "Publish it. Requests arrive in Business → Leads; reply to confirm the time.",
  },
  collect_feedback: {
    id: "collect_feedback", mode: "business", name: "Collect Feedback", free: false,
    promise: "Ask customers how it went, privately, with an option to be featured.",
    fields: [
      { id: "what", type: "text", label: "What should they give feedback on?", placeholder: "Your recent order", max: 60, required: true },
      { id: "feature", type: "choice", label: "Ask permission to feature their words?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
    ],
    defaults: () => ({ what: "", feature: "yes" }),
    creates: () => ["A feedback form on Business Mode, as a draft", "Answers stay private in Responses unless they agree to be featured"],
    build: (a) => plan([action("submission", "How did we do?", `We'd love your honest feedback on ${clip(a.what, 60) || "your experience"}.`,
      { prompt: `How was ${clip(a.what, 60) || "your experience"}?`, allowAnonymous: false, emailRequired: false, askFeatureConsent: a.feature !== "no", thanks: "Thank you. It helps us a lot." }, "Thanks for the feedback")]),
    next: "Publish it and send the link to recent customers.",
  },

  // ------------------------------------------------------------------ Creator
  grow_audience: {
    id: "grow_audience", mode: "creator", name: "Grow My Audience", free: true,
    promise: "A newsletter sign-up with a clear promise and a warm welcome.",
    fields: [
      { id: "about", type: "text", label: "What do you send?", placeholder: "Behind-the-scenes of my studio", max: 80, required: true },
      { id: "frequency", type: "choice", label: "How often?", options: [{ value: "Weekly", label: "Weekly" }, { value: "Every two weeks", label: "Every two weeks" }, { value: "Monthly", label: "Monthly" }] },
      { id: "welcome", type: "text", label: "Welcome line after they confirm", placeholder: "You're in. First letter lands Friday.", max: 60 },
    ],
    defaults: () => ({ about: "", frequency: "Monthly", welcome: "" }),
    creates: (a) => [`A newsletter sign-up: ${clip(a.about, 80) || "your letter"}, ${(a.frequency || "Monthly").toLowerCase()}, as a draft`, "Subscribers confirm by email, then count in your Audience", "Your welcome line on the thank-you screen"],
    build: (a, ctx) => plan([action("newsletter", `${ctx.firstName ? `${ctx.firstName}'s` : "The"} letter`, clip(a.about, 200) || "Notes from what I'm making.",
      { promise: clip(a.about, 200), frequency: a.frequency || "Monthly", askName: true, thanks: clip(a.welcome, 120) || "Check your inbox to confirm." }, clip(a.welcome, 60) || "You're in")]),
    next: "Publish it, then email your list from Creator → Audience.",
  },
  launch_product: {
    id: "launch_product", mode: "creator", name: "Launch a Product", free: false,
    promise: "A launch waitlist and a product draft, ready for launch day.",
    fields: [
      { id: "product", type: "text", label: "What are you launching?", placeholder: "Film presets vol. 2", max: 80, required: true },
      { id: "kind", type: "choice", label: "What kind of product?", options: [{ value: "digital", label: "Digital download" }, { value: "service", label: "Service" }] },
      { id: "price", type: "money", label: "Launch price" },
      { id: "currency", type: "choice", label: "Currency", options: CURRENCY_OPTIONS },
    ],
    defaults: () => ({ product: "", kind: "digital", price: "", currency: "EUR" }),
    creates: (a) => [`A launch waitlist for ${clip(a.product, 80) || "your product"}, as a draft`, "Waitlist sign-ups confirm by email and join your Audience", `A product draft${a.price ? ` at ${a.price} ${a.currency || "EUR"}` : ""} in Commerce, unpublished`],
    build: (a) => {
      const name = clip(a.product, 80) || "My product";
      const price = parseMajor(a.price);
      const currency = (["EUR", "USD", "GBP"].includes(a.currency) ? a.currency : "EUR") as GoalOfferDraft["currency"];
      return plan([action("newsletter", `Get early access: ${name}`.slice(0, 80), `Join the waitlist for ${name}. You'll hear first when it launches.`,
        { promise: `First access to ${name} on launch day.`, frequency: "Launch updates only", askName: true, thanks: "You're on the list. Watch your inbox on launch day." }, "You're on the list", "Join the waitlist")],
        { offer: price && price >= 50 ? { offer_type: a.kind === "service" ? "service" : "digital", title: name, description: "", currency, unit_amount_minor: price } : null });
    },
    next: "Publish the waitlist now. Add files and a cover to the product in Commerce, then go live on launch day.",
  },
  reward_fans: {
    id: "reward_fans", mode: "creator", name: "Reward My Fans", free: false,
    promise: "A giveaway with confirmed entries and a fair, auditable draw.",
    fields: [
      { id: "prize", type: "text", label: "What's the prize?", placeholder: "A signed print", max: 120, required: true },
      { id: "days", type: "number", label: "Open for how many days?", min: 1, max: 60, placeholder: "14" },
      { id: "minAge", type: "choice", label: "Minimum age", options: [{ value: "16", label: "16+" }, { value: "18", label: "18+" }, { value: "21", label: "21+" }] },
    ],
    defaults: () => ({ prize: "", days: "14", minAge: "18" }),
    creates: (a) => [`A giveaway for ${clip(a.prize, 80) || "your prize"}, open ${a.days || 14} days, as a draft`, "Entries count once confirmed by email", "When it ends, draw winners from Creator → Actions"],
    build: (a, ctx) => {
      const days = Math.min(60, Math.max(1, Number.parseInt(a.days, 10) || 14));
      const minAge = ([16, 18, 21].includes(Number(a.minAge)) ? Number(a.minAge) : 18) as ActionConfig["minAge"];
      return plan([action("giveaway", `Win ${clip(a.prize, 70) || "a prize"}`, "Enter for a chance to win. One entry per person; confirm your email to count.",
        { prize: clip(a.prize, 120), minAge, eligibility: `${minAge}+`, rules: "One entry per person. Winners are drawn at random from confirmed entries after the giveaway closes.", thanks: "Confirm your email to enter." },
        "Almost there", null, { starts_at: null, ends_at: new Date(ctx.now + days * day).toISOString() })]);
    },
    next: "Publish it. After it closes, draw and announce winners from the giveaway's page.",
  },

  // ------------------------------------------------------------------ Event
  host_event: {
    id: "host_event", mode: "event", name: "Host an Event", free: true,
    promise: "An event page with RSVPs, capacity, a waitlist and check-in at the door.",
    fields: [
      { id: "title", type: "text", label: "What's the event?", placeholder: "Spring Supper Club", max: 100, required: true },
      { id: "starts", type: "datetime", label: "When does it start?" },
      { id: "city", type: "text", label: "City", placeholder: "Amsterdam", max: 80 },
      { id: "capacity", type: "number", label: "How many guests?", min: 1, max: 10000, placeholder: "40", hint: "Leave empty for no limit" },
    ],
    defaults: (ctx) => ({ title: "", starts: defaultEventStart(ctx.now), city: "", capacity: "" }),
    creates: (a) => [`An event: ${clip(a.title, 100) || "your event"}, as a draft`, a.capacity ? `RSVPs up to ${a.capacity} guests, then a waitlist` : "RSVPs with no guest limit", "Guest passes with QR check-in at the door"],
    build: (a, ctx) => {
      const start = parseLocal(a.starts) ?? Date.parse(`${defaultEventStart(ctx.now)}:00Z`);
      const capacity = Number.parseInt(a.capacity, 10);
      return plan([], { event: { title: clip(a.title, 100) || "My event", summary: "", starts_at: new Date(start).toISOString(), ends_at: new Date(start + 3 * 3_600_000).toISOString(), timezone: ctx.timezone, venue_name: "", city: clip(a.city, 80), capacity: Number.isFinite(capacity) && capacity >= 1 ? Math.min(capacity, 10000) : null, waitlist_enabled: true } });
    },
    next: "Add the venue and a cover, then publish. Guests get a pass to show at the door.",
  },
  grow_attendance: {
    id: "grow_attendance", mode: "event", name: "Grow Attendance", free: false,
    promise: "An updates list so people hear about your next events first.",
    fields: [
      { id: "series", type: "text", label: "What kind of events do you host?", placeholder: "Monthly design meetups", max: 80, required: true },
      { id: "city", type: "text", label: "Where?", placeholder: "Rotterdam", max: 60 },
    ],
    defaults: () => ({ series: "", city: "" }),
    creates: () => ["An event updates sign-up on Event Mode, as a draft", "Subscribers confirm by email; email them when tickets open"],
    build: (a) => plan([action("newsletter", "Hear about the next one", `${clip(a.series, 80) || "Events"}${a.city ? ` in ${clip(a.city, 60)}` : ""}. Be the first to know when RSVPs open.`,
      { promise: "An email when the next event opens, nothing else.", frequency: "When there's a new event", askName: true, thanks: "You're on the list." }, "You're on the list", "Keep me posted")]),
    next: "Publish it and link it from your event pages and invitations.",
  },
  after_event: {
    id: "after_event", mode: "event", name: "After the Event", free: false,
    promise: "Ask guests how it went and who they'd like to stay in touch with.",
    fields: [
      { id: "event", type: "text", label: "Which event?", placeholder: "Spring Supper Club", max: 80, required: true },
      { id: "next", type: "choice", label: "Ask if they'd come again?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
    ],
    defaults: () => ({ event: "", next: "yes" }),
    creates: (a) => [`A feedback form for ${clip(a.event, 80) || "your event"}, as a draft`, "Answers arrive in Responses; guests who opted to connect already appear in Connections"],
    build: (a) => {
      const questions: Question[] = [q("q1", "How was it?", "choice", ["Loved it", "Good", "Could be better"], true), q("q2", "What should we change next time?", "long")];
      if (a.next !== "no") questions.push(q("q3", "Would you come again?", "choice", ["Yes", "Maybe", "No"]));
      return plan([action("form", `How was ${clip(a.event, 60) || "the event"}?`, "Thanks for coming. Two minutes of feedback helps us make the next one better.",
        { askName: false, emailRequired: false, questions, thanks: "Thank you for coming." }, "Thank you")]);
    },
    next: "Publish it and send the link to your guest list.",
  },
};

export const MODE_GOALS: Record<ModeSlug, GoalId[]> = {
  personal: ["meet_connect", "ask_me_anything", "grow_network"],
  business: ["get_more_clients", "book_consultation", "collect_feedback"],
  creator: ["launch_product", "grow_audience", "reward_fans"],
  event: ["host_event", "grow_attendance", "after_event"],
};

/** Server-side check of answers before anything is created. Returns a message or null. */
export function validateAnswers(goal: Goal, answers: GoalAnswers): string | null {
  for (const field of goal.fields) {
    const value = (answers[field.id] ?? "").trim();
    if (field.type === "text") {
      if (field.required && !value) return `Add “${field.label}”.`;
      if (value.length > field.max) return `“${field.label}” is too long.`;
    } else if (field.type === "choice") {
      if (value && !field.options.some((option) => option.value === value)) return `Choose an option for “${field.label}”.`;
    } else if (field.type === "number") {
      if (value) { const n = Number(value); if (!Number.isInteger(n) || n < field.min || n > field.max) return `“${field.label}” must be between ${field.min} and ${field.max}.`; }
    } else if (field.type === "datetime") {
      if (value && parseLocal(value) === null) return `Check “${field.label}”.`;
    } else if (field.type === "money") {
      if (value) { const minor = parseMajor(value); if (minor === null || minor < 50) return "The lowest price is 0.50."; }
    }
  }
  return null;
}

/** Copies only the fields a goal knows, trimmed, so nothing else reaches the database. */
export function cleanAnswers(goal: Goal, raw: Record<string, unknown>): GoalAnswers {
  const out: GoalAnswers = {};
  for (const field of goal.fields) out[field.id] = typeof raw[field.id] === "string" ? (raw[field.id] as string).trim().slice(0, 200) : "";
  return out;
}

export type GoalRecord = { type: "action" | "event" | "offer"; id: string; kind?: string; title?: string; status?: string; responses?: number };
export type GoalProgress = { id: string; template: GoalId; mode_slug: ModeSlug; created_at: string; records: GoalRecord[] };

/** Where the owner edits a record a goal created. */
export function recordHref(record: Pick<GoalRecord, "type" | "id">, mode: ModeSlug) {
  if (record.type === "event") return `/app/identity/events/${record.id}`;
  if (record.type === "offer") return "/app/identity/creator/commerce/products";
  return mode === "creator" ? `/app/identity/creator/actions/${record.id}` : `/app/identity/actions/${record.id}?mode=${mode}`;
}
export const goalsHref = (mode?: ModeSlug) => `/app/identity/goals${mode ? `?mode=${mode}` : ""}`;
export const goalHref = (id: GoalId) => `/app/identity/goals/${id}`;
/** Where a goal's drafts are listed. */
export function draftsHref(mode: ModeSlug, plan: GoalPlan) {
  if (plan.event) return "/app/identity/events";
  if (!plan.actions.length && plan.offer) return "/app/identity/creator/commerce/products";
  return mode === "creator" ? "/app/identity/creator/actions" : `/app/identity/actions?mode=${mode}`;
}
