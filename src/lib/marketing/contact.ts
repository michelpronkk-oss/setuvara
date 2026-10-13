import { z } from "zod";

/** The public address people can always write to. The form's destination is set server-side (CONTACT_INBOX). */
export const CONTACT_EMAIL = "hello@setuvara.com";

export const INQUIRY_TYPES = [
  { value: "general", label: "General", hint: "Questions, ideas, press, anything else." },
  { value: "support", label: "Support", hint: "Help with your account, plan or profile." },
  { value: "partnerships", label: "Partnerships / Events", hint: "Events, venues, communities and collaborations." },
  { value: "teams", label: "Teams / Business", hint: "Setuvara for your company or team." },
] as const;

export type InquiryType = (typeof INQUIRY_TYPES)[number]["value"];

/** Types where a company or organisation helps us answer. The field only shows for these. */
export const COMPANY_TYPES: readonly InquiryType[] = ["partnerships", "teams"];

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 4000;

const types = INQUIRY_TYPES.map((type) => type.value) as [InquiryType, ...InquiryType[]];

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Add your name.").max(120, "Keep your name under 120 characters."),
  email: z.string().trim().min(1, "Add your email so we can reply.").max(254, "That email is too long.").email("Check your email address."),
  type: z.enum(types, { error: "Choose what this is about." }),
  company: z.string().trim().max(120, "Keep this under 120 characters.").optional().default(""),
  message: z.string().trim().min(1, "Write a short message.").min(MESSAGE_MIN, "Tell us a little more.").max(MESSAGE_MAX, `Keep it under ${MESSAGE_MAX.toLocaleString("en")} characters.`),
  /** Honeypot: hidden from people, filled in by bots. */
  website: z.string().max(200).optional().default(""),
  /** When the form opened (ms since epoch). Submissions faster than a person can type are dropped. */
  openedAt: z.number().int().positive(),
});

export type ContactInquiry = z.infer<typeof contactSchema>;
export type ContactField = "name" | "email" | "type" | "company" | "message";

/** First message per visible field, for inline errors on the client and in the API response. */
export function contactFieldErrors(input: unknown): Partial<Record<ContactField, string>> {
  const parsed = contactSchema.safeParse(input);
  if (parsed.success) return {};
  const errors: Partial<Record<ContactField, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if ((key === "name" || key === "email" || key === "type" || key === "company" || key === "message") && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function inquiryLabel(type: InquiryType) {
  return INQUIRY_TYPES.find((item) => item.value === type)?.label ?? "General";
}
