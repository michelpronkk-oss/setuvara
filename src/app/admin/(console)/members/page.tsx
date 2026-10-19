import type { Metadata } from "next";
import Link from "next/link";

import { Badge, Initial, PageHeader, Pager, Panel, PlanBadge, Table, Tabs, Td, Th } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/auth";
import { listMembers, MEMBER_FILTERS, MEMBER_PAGE_SIZE, type MemberFilter } from "@/lib/admin/data";
import { formatCount, formatDay, formatRelative } from "@/lib/admin/format";

export const metadata: Metadata = { title: "Members" };

const FILTER_LABELS: Record<MemberFilter, string> = { all: "All", paid: "Paid", free: "Free", unpublished: "Not published" };

function href(query: string, filter: MemberFilter, page = 1) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter !== "all") params.set("filter", filter);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return `/members${search ? `?${search}` : ""}`;
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  await requireAdminPage("members");
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 120);
  const filter = (MEMBER_FILTERS as readonly string[]).includes(params.filter ?? "") ? params.filter as MemberFilter : "all";
  const page = Math.max(1, Math.min(4000, Number.parseInt(params.page ?? "1", 10) || 1));
  const { total, rows } = await listMembers({ query, filter, page });

  return (
    <>
      <PageHeader description="Every account, newest first. Opening a member is recorded in the audit log." title="Members" />

      <form action="/members" className="mb-3 flex gap-2" role="search">
        {filter !== "all" ? <input name="filter" type="hidden" value={filter} /> : null}
        <label className="sr-only" htmlFor="member-search">Search members</label>
        <input
          className="h-10 min-w-0 flex-1 rounded-[10px] bg-white px-3.5 text-[13.5px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)] outline-none placeholder:text-ink/40 focus:shadow-[inset_0_0_0_2px_#0d0d0d]"
          defaultValue={query}
          id="member-search"
          name="q"
          placeholder="Name, @username, email or ID"
          type="search"
        />
        <button className="h-10 rounded-[10px] bg-ink px-4 text-[13px] font-semibold text-paper" type="submit">Search</button>
      </form>

      <Tabs current={filter} options={MEMBER_FILTERS.map((value) => ({ label: FILTER_LABELS[value], value, href: href(query, value) }))} />

      <Panel className="mt-3" padded={false}>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink/50">{query ? `No members match “${query}”.` : "No members in this view."}</p>
        ) : (
          <>
            {/* Phones: one card per member */}
            <ul className="divide-y divide-ink/[0.06] md:hidden">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link className="flex items-center gap-3 px-4 py-3 active:bg-ink/[0.03]" href={`/members/${row.id}`}>
                    <Initial name={row.display_name ?? row.email} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13.5px] font-semibold">{row.display_name ?? "No profile"}</p>
                        <PlanBadge plan={row.billing.plan} />
                      </div>
                      <p className="truncate text-[12px] text-ink/55">{row.username ? `@${row.username} · ` : ""}{row.email}</p>
                    </div>
                    <span className="shrink-0 text-right text-[11.5px] text-ink/45">{formatDay(row.created_at, true)}</span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden md:block">
              <Table minWidth={860}>
                <thead className="bg-ink/[0.02]">
                  <tr>
                    <Th>Member</Th>
                    <Th>Plan</Th>
                    <Th>Status</Th>
                    <Th>Joined</Th>
                    <Th>Last sign-in</Th>
                    <Th align="right">Connections</Th>
                    <Th align="right">Views 30d</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className="group border-t border-ink/[0.06] hover:bg-ink/[0.015]" key={row.id}>
                      <Td>
                        <Link className="flex items-center gap-3 outline-none" href={`/members/${row.id}`}>
                          <Initial name={row.display_name ?? row.email} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold group-hover:underline">{row.display_name ?? "No profile"}</span>
                            <span className="block truncate text-[12px] text-ink/55">{row.username ? `@${row.username} · ` : ""}{row.email}</span>
                          </span>
                        </Link>
                      </Td>
                      <Td><PlanBadge plan={row.billing.plan} /></Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {row.banned ? <Badge tone="bad">Banned</Badge> : null}
                          {!row.email_confirmed ? <Badge tone="warn">Unconfirmed</Badge> : null}
                          {row.is_published ? <Badge dot tone="good">Published</Badge> : <Badge>Not published</Badge>}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-ink/70">{formatDay(row.created_at)}</Td>
                      <Td className="whitespace-nowrap text-ink/70">{formatRelative(row.last_sign_in_at)}</Td>
                      <Td align="right">{formatCount(row.connections)}</Td>
                      <Td align="right">{formatCount(row.views_30d)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
        <div className="border-t border-ink/[0.06]">
          {total > MEMBER_PAGE_SIZE ? <Pager href={(next) => href(query, filter, next)} page={page} pageSize={MEMBER_PAGE_SIZE} total={total} /> : (
            <p className="px-4 py-3 text-[12.5px] text-ink/50 sm:px-5">{formatCount(total)} {total === 1 ? "member" : "members"}</p>
          )}
        </div>
      </Panel>
    </>
  );
}
