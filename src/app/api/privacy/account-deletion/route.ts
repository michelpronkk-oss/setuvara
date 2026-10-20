import { contactInbox, inquiryBodies, sameOrigin, sendInquiryEmail } from "@/lib/marketing/inquiry-mail";
import { cancelAccountDeletion, requestAccountDeletion } from "@/lib/privacy/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function member() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  const email = typeof claims?.claims?.email === "string" ? claims.claims.email : "";
  if (error || !userId) return null;
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  return { userId, email, username: (profile?.username as string | undefined) ?? null };
}

/**
 * A signed-in member asks for their account to be deleted, confirming with their username. This
 * records the request and tells the team; nothing is deleted here, because a person checks paid
 * plans and payouts first. Disconnecting platforms stays a separate, immediate action.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  const who = await member();
  if (!who) return Response.json({ error: "Sign in again." }, { status: 401 });
  const body = await request.json().catch(() => null) as { confirm?: unknown } | null;
  const typed = typeof body?.confirm === "string" ? body.confirm.trim().toLowerCase().replace(/^@/, "") : "";
  if (!who.username || typed !== who.username) return Response.json({ error: "Type your username exactly to confirm." }, { status: 400 });

  try {
    const { request: row, created } = await requestAccountDeletion(who.userId);
    if (created) {
      const { text, html } = inquiryBodies({
        kicker: "Account deletion request",
        name: `@${who.username}`,
        rows: [["Username", `@${who.username}`], ["Account email", who.email || "(not in session)"], ["Confirmation code", row.confirmation_code], ["Member id", who.userId]],
      });
      const sent = await sendInquiryEmail({ to: contactInbox(), replyTo: who.email || contactInbox(), subject: `Account deletion request · @${who.username}`, text, html, tag: "account_deletion" });
      if (sent !== "sent") console.error("account_deletion_notice_unsent", sent);
    }
    return Response.json({ ok: true, code: row.confirmation_code, status: row.status, created });
  } catch {
    return Response.json({ error: "We couldn't record that just now. Nothing changed. Try again." }, { status: 500 });
  }
}

/** Withdraws an open request before anyone has started on it. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  const who = await member();
  if (!who) return Response.json({ error: "Sign in again." }, { status: 401 });
  try {
    return Response.json({ ok: true, cancelled: await cancelAccountDeletion(who.userId) });
  } catch {
    return Response.json({ error: "We couldn't change that just now. Try again." }, { status: 500 });
  }
}
