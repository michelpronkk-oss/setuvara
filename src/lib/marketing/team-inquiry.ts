import { z } from "zod";

export const TEAM_SIZES = ["1–10", "11–50", "51–200", "201–1,000", "1,000+"] as const;

export const teamInquirySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().min(1).max(120),
  size: z.enum(TEAM_SIZES),
  message: z.string().trim().max(2000).optional().default(""),
  /** Honeypot: hidden from people, filled in by bots. */
  website: z.string().max(200).optional().default(""),
  /** When the form opened (ms since epoch). Submissions faster than a person can type are dropped. */
  openedAt: z.number().int().positive(),
});

export type TeamInquiry = z.infer<typeof teamInquirySchema>;
