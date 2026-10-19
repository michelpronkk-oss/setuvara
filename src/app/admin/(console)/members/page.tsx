import type { Metadata } from "next";
import Link from "next/link";

import { Badge, buttonClass, Empty, Initial, PageHeader, Pager, Panel, PlanBadge, Table, Tabs, Td, Th } from "@/components/admin/ui";
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
      <PageHeader description="Every account, newest first. Opening a member is recorded in the audit log." eyebrow={`${formatCount(total)} ${total === 1 ? "account" : "accounts"}${filter !== "all" ? ` · ${FILTER_LABELS[filter]}` : ""}`} title="Members" />

      <form action="/members" className="mb-4 flex h-14 w-full max-w-[640px] items-center gap-1 rounded-full bg-white pl-5 pr-1.5 shadow-[inset_0_0_0_1.5px_#0d0d0d] focus-within:shadow-[inset_0_0_0_2.5px_#0d0d0d]" role="search">
        {filter !== "all" ? <input name="filter" type="hidden" value={filter} /> : null}
        <label className="sr-only" htmlFor="member-search">Search members</label>
        <svg aria-hidden="true" className="size-[18px] shrink-0 text-ink/40" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
        <input
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-[15px] outline-none placeholder:text-ink/40"
          defaultValue={query}
          id="member-search"
          name="q"
          placeholder="Name, @username, email or ID"
          type="search"
        />
        <button className={buttonClass("primary", "md")} type="submit">Search</button>
      </form>

      <Tabs current={filter} options={MEMBER_FILTERS.map((value) => ({ label: FILTER_LABELS[value], value, href: href(query, value) }))} />

      <Panel className="mt-4" padded={false}>
        {rows.length === 0 ? (
          <Empty>{query ? `No members match “${query}”.` : "No members in this view."}</Empty>
        ) : (
          <>
            {/* Phones: one card per member */}
            <ul className="divide-y divide-ink/[0.07] md:hidden">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link className="flex items-center gap-3 px-5 py-4 active:bg-paper" href={`/members/${row.id}`}>
                    <Initial name={row.display_name ?? row.email} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-semibold tracking-[-0.01em]">{row.display_name ?? "No profile"}</p>
                        <PlanBadge plan={row.billing.plan} />
                      </div>
                      <p className="mt-0.5 truncate text-[12.5px] text-ink/50">{row.username ? `@${row.username} · ` : ""}{row.email}</p>
                    </div>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-right text-[11.5px] text-ink/45">{formatDay(row.created_at, true)}<span aria-hidden="true" className="text-[15px] text-ink/30">→</span></span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden md:block">
              <Table minWidth={860}>
                <thead>
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
                    <tr className="group border-t border-ink/[0.06] hover:bg-paper/60" key={row.id}>
                      <Td>
                        <Link className="flex items-center gap-3 outline-none" href={`/members/${row.id}`}>
                          <Initial name={row.display_name ?? row.email} />
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-semibold group-hover:underline group-hover:underline-offset-4">{row.display_name ?? "No profile"}</span>
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
        <div className="border-t border-ink/[0.07]">
          {total > MEMBER_PAGE_SIZE ? <Pager href={(next) => href(query, filter, next)} page={page} pageSize={MEMBER_PAGE_SIZE} total={total} /> : (
            <p className="px-5 py-4 text-[12.5px] text-ink/50 sm:px-7">{formatCount(total)} {total === 1 ? "member" : "members"}</p>
          )}
        </div>
      </Panel>
    </>
  );
}
