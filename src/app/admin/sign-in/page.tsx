import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminSignIn } from "@/components/admin/sign-in";
import { getAdminGate } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

/**
 * One page walks an admin through each gate: password, then a second factor (set up on first visit).
 * Members without admin access learn only that this account has none.
 */
export default async function AdminSignInPage() {
  const gate = await getAdminGate();
  if (gate.state === "ok") redirect("/");
  return <AdminSignIn email={gate.state === "signed_out" ? null : gate.email} step={gate.state} />;
}
