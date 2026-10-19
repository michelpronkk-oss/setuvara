import type { Metadata } from "next";
import Link from "next/link";

import { Badge, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/auth";
import { listAdmins } from "@/lib/admin/data";
import { formatDay, formatRelative } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Access" };

const GRANT_SQL = `insert into private.admin_members (user_id, role, note)
select id, 'admin', 'Support'
from auth.users where email = 'teammate@example.com';`;

const REVOKE_SQL = `update private.admin_members
set revoked_at = now()
where user_id = (select id from auth.users where email = 'teammate@example.com');`;

export default async function AccessPage() {
  await requireAdminPage("access");
  const admins = await listAdmins();

  return (
    <>
      <PageHeader description="Who can open Admin. Access is granted in the Supabase SQL editor, never from this page, and every change is logged." title="Access" />

      <Panel padded={false} title="Admins">
        <Table minWidth={680}>
          <thead className="bg-ink/[0.02]"><tr><Th>Account</Th><Th>Role</Th><Th>Two-step</Th><Th>Last sign-in</Th><Th>Since</Th></tr></thead>
          <tbody>
            {admins.map((admin) => (
              <tr className="border-t border-ink/[0.06]" key={admin.user_id}>
                <Td>
                  <Link className="font-semibold hover:underline" href={`/members/${admin.user_id}`}>{admin.email}</Link>
                  {admin.note ? <span className="ml-2 text-[12px] text-ink/50">{admin.note}</span> : null}
                </Td>
                <Td>{admin.revoked_at ? <Badge tone="bad">Revoked {formatDay(admin.revoked_at, true)}</Badge> : <Badge tone={admin.role === "owner" ? "ink" : "neutral"}>{admin.role}</Badge>}</Td>
                <Td>{admin.mfa_factors > 0 ? <Badge dot tone="good">On</Badge> : <Badge tone="warn">Not set up</Badge>}</Td>
                <Td className="text-ink/70">{formatRelative(admin.last_sign_in_at)}</Td>
                <Td className="text-ink/70">{formatDay(admin.created_at)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel title="Roles">
          <dl className="space-y-3 text-[12.5px] leading-[18px]">
            <div><dt className="font-semibold">Owner</dt><dd className="text-ink/60">Everything, including this page.</dd></div>
            <div><dt className="font-semibold">Admin</dt><dd className="text-ink/60">Members, support inbox, billing, health and the audit log. Can change feedback status.</dd></div>
            <div><dt className="font-semibold">Analyst</dt><dd className="text-ink/60">Overview, billing totals and health only. No member records or emails.</dd></div>
          </dl>
        </Panel>
        <Panel className="lg:col-span-2" description="The person needs a confirmed Setuvara account first. They set up two-step sign-in on their first visit." title="Grant or revoke">
          <p className="text-[12px] font-semibold text-ink/60">Grant</p>
          <pre className="mt-1.5 overflow-x-auto rounded-[10px] bg-ink px-3.5 py-3 font-label text-[11.5px] leading-[18px] text-paper">{GRANT_SQL}</pre>
          <p className="mt-3 text-[12px] font-semibold text-ink/60">Revoke (takes effect on their next request)</p>
          <pre className="mt-1.5 overflow-x-auto rounded-[10px] bg-ink px-3.5 py-3 font-label text-[11.5px] leading-[18px] text-paper">{REVOKE_SQL}</pre>
        </Panel>
      </div>
    </>
  );
}
