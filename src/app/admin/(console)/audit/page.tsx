import type { Metadata } from "next";

import { AuditList } from "@/components/admin/audit-list";
import { PageHeader, Pager, Panel } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/auth";
import { listAudit } from "@/lib/admin/data";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdminPage("audit");
  const page = Math.max(1, Math.min(2000, Number.parseInt((await searchParams).page ?? "1", 10) || 1));
  const audit = await listAudit({ page });

  return (
    <>
      <PageHeader description="Every admin sign-in, member view, provider check and change, newest first. Entries can’t be edited or deleted, by anyone." eyebrow="Append-only" title="Audit log" />
      <Panel padded={false}>
        <AuditList rows={audit.rows} />
        <div className="border-t border-ink/[0.07]">
          <Pager href={(next) => `/audit?page=${next}`} page={page} pageSize={50} total={audit.total} />
        </div>
      </Panel>
    </>
  );
}
