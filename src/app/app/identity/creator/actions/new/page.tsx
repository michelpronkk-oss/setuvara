import type { Metadata } from "next";
import Link from "next/link";

import { ActionEditor } from "@/components/actions/action-editor";
import { KindPicker } from "@/components/actions/kind-picker";
import { StudioHead, StudioPage } from "@/components/creator/studio-ui";
import { ACTION_KIND_NAME, ACTION_KINDS, starterAction, type ActionKind } from "@/lib/actions/model";
import { loadCreatorStudio } from "@/lib/creator/studio-server";

export const metadata: Metadata = { title: "New Action · Creator · Setuvara" };

export default async function NewActionPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const [studio, query] = await Promise.all([loadCreatorStudio("/app/identity/creator/actions/new"), searchParams]);
  if (!studio.mode) return null;
  const kind = (ACTION_KINDS as readonly string[]).includes(query.kind ?? "") ? query.kind as ActionKind : null;
  const firstName = studio.profile.display_name.split(/\s+/)[0] || studio.profile.display_name;
  const back = <Link className="inline-flex min-h-11 items-center rounded-full px-3 text-[15px] font-semibold text-black/70 hover:bg-black/[0.04]" href={kind ? "/app/identity/creator/actions/new" : "/app/identity/creator/actions"}>← Back</Link>;
  if (!kind) {
    return <StudioPage><StudioHead action={back} title="New Action" /><KindPicker limits={studio.limits} /></StudioPage>;
  }
  const starter = starterAction(kind, firstName);
  return (
    <StudioPage>
      <StudioHead action={back} sub="Draft" title={ACTION_KIND_NAME[kind]} />
      <ActionEditor
        covers={studio.work.filter((item) => item.kind === "image").map((item) => ({ id: item.id, imageUrl: item.imageUrl, title: item.title }))}
        firstName={firstName}
        initial={null}
        kind={kind}
        limits={studio.limits}
        locked={false}
        modeId={studio.mode.id}
        nextSortOrder={Math.min(1000, Math.max(-1, ...studio.actions.map((item) => item.sort_order)) + 1)}
        profileId={studio.userId}
        starter={{ title: starter.title, intro: starter.intro, cta_label: starter.cta_label, config: starter.config, cover_block_id: null, starts_at: null, ends_at: kind === "giveaway" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null }}
      />
    </StudioPage>
  );
}
