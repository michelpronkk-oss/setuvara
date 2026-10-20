import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { createBillingAdminClient } from "@/lib/billing/admin";
import { createClient } from "@/lib/supabase/server";

import { isAdminHost } from "./host";

export const ADMIN_ROLES = ["owner", "admin", "analyst"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * What each role may open. Analysts see aggregates only; member records, the support inbox and
 * the audit trail need admin; managing who has access is owner-only (and done in SQL).
 */
export const ADMIN_AREAS = {
  overview: ["owner", "admin", "analyst"],
  billing: ["owner", "admin", "analyst"],
  commerce: ["owner", "admin", "analyst"],
  health: ["owner", "admin", "analyst"],
  members: ["owner", "admin"],
  feedback: ["owner", "admin"],
  chatReports: ["owner", "admin"],
  audit: ["owner", "admin"],
  access: ["owner"],
} as const satisfies Record<string, readonly AdminRole[]>;
export type AdminArea = keyof typeof ADMIN_AREAS;

export function roleCanOpen(role: AdminRole, area: AdminArea) {
  return (ADMIN_AREAS[area] as readonly AdminRole[]).includes(role);
}

export type AdminSession = { userId: string; email: string; role: AdminRole };

export type AdminGate =
  | { state: "signed_out" }
  | { state: "no_access"; email: string }
  | { state: "mfa_enroll"; email: string }
  | { state: "mfa_verify"; email: string }
  | { state: "ok"; session: AdminSession };

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

/** The role of an active admin, read from the database with the server key. Null means no access. */
export async function readAdminRole(userId: string): Promise<AdminRole | null> {
  const { data, error } = await createBillingAdminClient().rpc("admin_access", { p_user_id: userId });
  if (error) throw new Error("admin_access_unavailable");
  return isAdminRole(data) ? data : null;
}

/**
 * Resolves the caller against Supabase Auth (verified with the Auth server, never from the cookie alone),
 * the server-side admin list, and a second factor. Deny by default: any failure is "signed_out".
 */
export const getAdminGate = cache(async (): Promise<AdminGate> => {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.id || !user.email_confirmed_at) return { state: "signed_out" };
    const email = user.email ?? "";

    const role = await readAdminRole(user.id);
    if (!role) return { state: "no_access", email };

    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || !assurance) return { state: "signed_out" };
    if (assurance.currentLevel !== "aal2") {
      return assurance.nextLevel === "aal2" ? { state: "mfa_verify", email } : { state: "mfa_enroll", email };
    }

    return { state: "ok", session: { userId: user.id, email, role } };
  } catch {
    return { state: "signed_out" };
  }
});

async function assertAdminHost() {
  const requestHeaders = await headers();
  if (!isAdminHost(requestHeaders.get("host"))) notFound();
}

/** For admin pages: sends anyone who isn't a fully verified admin to sign-in, and hides areas their role can't open. */
export async function requireAdminPage(area: AdminArea): Promise<AdminSession> {
  await assertAdminHost();
  const gate = await getAdminGate();
  if (gate.state !== "ok") redirect("/sign-in");
  if (!roleCanOpen(gate.session.role, area)) notFound();
  return gate.session;
}

const noStore = { "Cache-Control": "private, no-store" };

export function adminJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: noStore });
}

/**
 * For admin API routes. Writes must come from the admin origin itself (same-origin fetch), so a
 * page elsewhere can't ride an admin's cookies.
 */
export async function requireAdminApi(request: Request, area: AdminArea): Promise<AdminSession | Response> {
  const host = request.headers.get("host");
  if (!isAdminHost(host)) return adminJson({ error: "not_found" }, 404);

  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    let sameOrigin = false;
    try {
      sameOrigin = origin !== null && new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin || request.headers.get("sec-fetch-site") === "cross-site") return adminJson({ error: "forbidden" }, 403);
  }

  const gate = await getAdminGate();
  if (gate.state === "signed_out" || gate.state === "no_access") return adminJson({ error: "unauthorized" }, 401);
  if (gate.state !== "ok") return adminJson({ error: "mfa_required" }, 401);
  if (!roleCanOpen(gate.session.role, area)) return adminJson({ error: "forbidden" }, 403);
  return gate.session;
}

/** Appends an access record (who looked at what) to the audit log. Throws if it can't be written. */
export async function recordAdminAccess(
  session: AdminSession,
  action: "member.viewed" | "feedback.screenshot_viewed" | "billing.provider_checked" | "session.started",
  target: { type: string; id: string } | null,
  context: Record<string, string | number | boolean> = {},
) {
  const { error } = await createBillingAdminClient().rpc("admin_record_access", {
    p_actor: session.userId,
    p_action: action,
    p_target_type: target?.type ?? null,
    p_target_id: target?.id ?? null,
    p_context: context,
  });
  if (error) throw new Error("admin_audit_unavailable");
}
