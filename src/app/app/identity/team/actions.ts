"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getPublicOrigin } from "@/lib/app/viewer";
import { EMAIL, invitePath, TEAM_HREF, TEAM_ROLES, TEAMS_HREF, TOKEN, workspaceHref, type TeamRole } from "@/lib/business/team";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERRORS: Record<string, string> = {
  teams_require_pro: "Teams come with Pro.",
  no_seats: "Every seat is taken. Remove someone or let an invite lapse first.",
  already_member: "They're already on your team.",
  own_email: "That's your own email.",
  invalid_email: "Add their email address.",
  rate_limited: "That's a lot of invites today. Try again tomorrow.",
  business_not_found: "Turn on Business Mode first.",
};
const say = (message?: string) => Object.entries(ERRORS).find(([key]) => message?.includes(key))?.[1] ?? "That didn't go through. Try again.";

/** Invites a teammate by email. The full link is shown once; only its fingerprint is kept. */
export async function inviteTeammate(email: string, role: TeamRole) {
  const value = email.trim();
  if (!EMAIL.test(value) || value.length > 254) return { ok: false as const, error: ERRORS.invalid_email };
  if (!TEAM_ROLES.includes(role)) return { ok: false as const, error: "Choose a role." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_business_member", { p_email: value, p_role: role });
  if (error) return { ok: false as const, error: say(error.message) };
  const origin = await getPublicOrigin(await headers());
  revalidatePath(TEAM_HREF);
  return { ok: true as const, url: `${origin}${invitePath((data as { token: string }).token)}` };
}

export async function setTeammateRole(memberId: string, role: TeamRole) {
  if (!UUID.test(memberId) || !TEAM_ROLES.includes(role)) return { ok: false as const, error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_business_member_role", { p_member_id: memberId, p_role: role });
  if (error || data !== true) return { ok: false as const, error: say(error?.message) };
  revalidatePath(TEAM_HREF);
  return { ok: true as const };
}

/** The owner removes a teammate or cancels an invite, or a teammate leaves. Access ends at once. */
export async function removeTeammate(memberId: string) {
  if (!UUID.test(memberId)) return { ok: false as const, error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_business_member", { p_member_id: memberId });
  if (error || data !== true) return { ok: false as const, error: say(error?.message) };
  revalidatePath(TEAM_HREF);
  revalidatePath(TEAMS_HREF, "layout");
  return { ok: true as const };
}

const ACCEPT_ERRORS: Record<string, string> = {
  invite_unavailable: "This invite has been used, cancelled or has ended. Ask for a new one.",
  wrong_account: "This invite is for another email. Sign in with the address it was sent to.",
  own_business: "This is your own business.",
  no_seats: "Every seat on this team is taken. Ask the owner to free one.",
};

/** Accepts an invite as the signed-in person. The database checks the confirmed email and the seat. */
export async function acceptTeamInvite(token: string) {
  if (!TOKEN.test(token)) return { ok: false as const, error: ACCEPT_ERRORS.invite_unavailable };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_business_invite", { p_token: token });
  if (error) return { ok: false as const, error: Object.entries(ACCEPT_ERRORS).find(([key]) => error.message.includes(key))?.[1] ?? "That didn't go through. Try again." };
  revalidatePath(TEAMS_HREF, "layout");
  return { ok: true as const, href: workspaceHref((data as { business_id: string }).business_id) };
}

/** Signs out and returns to sign-in, then back to the invite, for someone signed in with another email. */
export async function switchAccountForInvite(token: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(TOKEN.test(token) ? `/login?next=${encodeURIComponent(invitePath(token))}` : "/login");
}
