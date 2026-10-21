/**
 * Business Teams: the owner invites teammates by email; members work the leads, managers also
 * export. The database (20261025110000_business_teams.sql) decides every access per request; this
 * mirrors its shapes for pages and forms. Pure, so tests use it directly.
 */

import type { Booking } from "./bookings";
import type { BusinessLimits } from "./model";

export type TeamRole = "manager" | "member";
export const TEAM_ROLES: readonly TeamRole[] = ["member", "manager"];
export const ROLE_LABEL: Record<TeamRole | "owner", string> = { owner: "Owner", manager: "Manager", member: "Member" };
export const ROLE_NOTE: Record<TeamRole, string> = {
  member: "Works the leads: stages, notes, bookings coming up.",
  manager: "Everything a member does, and exports leads.",
};

export type TeamMember = {
  id: string; email: string; role: TeamRole; status: "invited" | "active"; expires_at: string | null;
  created_at: string; accepted_at: string | null; display_name: string | null; username: string | null;
};
export type Team = { seats: number; members: TeamMember[] };

/** A business someone works for, from my_business_teams(). `open` is false while the owner's plan has no seats. */
export type Membership = { member_id: string; business_id: string; role: TeamRole; display_name: string; username: string | null; company: string; open: boolean };

export type Invite = { business_name: string; business_username: string | null; email: string; role: TeamRole; company: string };

export type WorkspaceBooking = Booking & { name: string; title: string };
export type Workspace = {
  business_id: string; display_name: string; username: string | null; role: TeamRole | "owner"; company: string;
  limits: Pick<BusinessLimits, "plan" | "can_note" | "can_export">;
  actions: { id: string; title: string; kind: string }[];
  bookings: WorkspaceBooking[];
};

export const TOKEN = /^[A-Za-z0-9_-]{32}$/;
export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const TEAM_HREF = "/app/identity/team";
export const TEAMS_HREF = "/app/team";

/** The invite page for a token. */
export const invitePath = (token: string) => `/s/team-invite/${token}`;
/** A teammate's workspace for one business. */
export const workspaceHref = (businessId: string) => `${TEAMS_HREF}/${businessId}`;

/** Seats taken by members and live invites, and what is left. */
export function seatCount(team: Team) {
  const used = team.members.length;
  return { used, left: Math.max(0, team.seats - used) };
}

/** An invite email's problem, or null. The database checks again. */
export function inviteProblem(email: string, ownerEmail?: string | null) {
  const value = email.trim().toLowerCase();
  if (!EMAIL.test(value) || value.length > 254) return "Add their email address.";
  if (ownerEmail && value === ownerEmail.trim().toLowerCase()) return "That's your own email.";
  return null;
}

/** A prefilled email the owner can send with the invite link. */
export function teamInviteMail({ to, owner, business, role, url }: { to: string; owner: string; business: string; role: TeamRole; url: string }) {
  const subject = `Join ${business} on Setuvara`;
  const body = `Hi,\n\nI'd like you to work our leads with me on Setuvara, as ${role === "manager" ? "a manager" : "a member"} of ${business}.\n\nSign in or create an account with ${to}, then accept here (the link works for 7 days):\n\n${url}\n\n${owner}`;
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** "Mara Vos" for someone who joined, the email for an open invite. */
export const memberName = (member: Pick<TeamMember, "display_name" | "email">) => member.display_name?.trim() || member.email;
