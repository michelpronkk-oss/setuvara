"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { KindTile } from "@/components/actions/kind-picker";
import type { ModeSlug } from "@/components/profile/types";
import { ACTION_KIND_SHORT, MODE_KIND_ORDER, type ActionKind, type ProfileAction } from "@/lib/actions/model";
import { createClient } from "@/lib/supabase/client";
import type { EditorApi } from "./editor-types";
import { GroupHead } from "./editor-ui";

type Row = Pick<ProfileAction, "id" | "kind" | "status" | "title" | "sort_order" | "starts_at" | "ends_at">;

// Same addresses as the Actions workspace (lib/actions/studio-server, which is server-only).
const base = (slug: ModeSlug) => (slug === "creator" ? "/app/identity/creator/actions" : "/app/identity/actions");
const listHref = (slug: ModeSlug) => (slug === "creator" ? base(slug) : `${base(slug)}?mode=${slug}`);
const newHref = (slug: ModeSlug, kind?: ActionKind) => {
  const query = [slug === "creator" ? null : `mode=${slug}`, kind ? `kind=${kind}` : null].filter(Boolean).join("&");
  return `${base(slug)}/new${query ? `?${query}` : ""}`;
};


/**
 * The Mode's Actions as part of its page: in the order visitors see them, movable by drag or the arrows,
 * with a quick way to add the kinds that suit this Mode. Responses stay in the Actions workspace.
 */
export function PageActions({ api }: { api: EditorApi }) {
  const { mode, slug } = api;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void createClient().from("profile_actions").select("id, kind, status, title, sort_order, starts_at, ends_at")
      .eq("mode_id", mode.id).neq("status", "archived").order("sort_order").order("created_at")
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) { setError("Your Actions didn't load."); setRows([]); return; }
        setRows((data ?? []) as Row[]);
      });
    return () => { cancelled = true; };
  }, [mode.id]);

  const live = rows?.filter((row) => row.status === "published").length ?? 0;
  const kinds = MODE_KIND_ORDER[slug].slice(0, 3);

  return (
    <section aria-label="Actions" className="mt-8" data-page-actions>
      <GroupHead meta={rows === null ? undefined : rows.length ? `${live} live · placed in Your page above` : undefined} title="Actions" />
      {!api.actionsLive && rows !== null && rows.length > 0 && <p className="mb-2 rounded-[14px] bg-[#FFF3D6] px-4 py-2.5 text-[13px] leading-5">Visitors don&apos;t see Actions yet. Arrange them now; they appear in this order once Actions go live.</p>}

      {rows === null ? (
        <div aria-hidden="true" className="h-[68px] animate-pulse rounded-[20px] bg-black/[0.04]" />
      ) : rows.length > 0 ? null : (
        <Link className="group flex items-center gap-4 rounded-[20px] bg-[#0D0D0D] p-4 text-[#F5F4EF] transition hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-5" data-create-first-action href={listHref(slug)}>
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-[#FF5A4F] text-[22px] font-semibold leading-none text-[#0D0D0D]">+</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Create your first Action</span>
            <span className="mt-0.5 block text-[13px] leading-5 text-[#F5F4EF]/65">A newsletter, a form, a giveaway: a card on your page with its own form, in your Appearance.</span>
          </span>
          <span aria-hidden="true" className="text-lg text-[#F5F4EF]/50 transition-transform group-hover:translate-x-0.5 group-hover:text-[#F5F4EF]">→</span>
        </Link>
      )}
      {error && <p className="mt-2 text-[13px] font-medium text-[#B42318]" role="alert">{error}</p>}

      {rows !== null && rows.length > 0 && <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {kinds.map((kind) => (
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-full border-[1.5px] border-dashed border-black/20 pl-1.5 pr-3.5 text-[13px] font-semibold text-black/75 transition hover:border-black/60 hover:text-black focus-visible:outline-2" href={newHref(slug, kind)} key={kind}>
            <KindTile kind={kind} size={28} />{ACTION_KIND_SHORT[kind]}
          </Link>
        ))}
        <Link className="inline-flex min-h-10 items-center px-2 text-[13px] font-semibold text-black/60 underline decoration-black/20 underline-offset-4 hover:text-black hover:decoration-black" href={newHref(slug)}>All kinds</Link>
        <Link className="ml-auto inline-flex min-h-10 items-center text-[13px] font-semibold text-black/60 hover:text-black" href={listHref(slug)}>Responses →</Link>
      </div>}
    </section>
  );
}
