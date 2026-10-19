import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/shell";
import { ADMIN_AREAS, getAdminGate, roleCanOpen, type AdminArea } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

function environmentLabel() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost" ? "Local data" : "Live data";
  } catch {
    return "No database";
  }
}

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const gate = await getAdminGate();
  if (gate.state !== "ok") redirect("/sign-in");
  const areas = (Object.keys(ADMIN_AREAS) as AdminArea[]).filter((area) => roleCanOpen(gate.session.role, area));
  return (
    <AdminShell areas={areas} email={gate.session.email} environment={environmentLabel()} role={gate.session.role}>
      {children}
    </AdminShell>
  );
}
