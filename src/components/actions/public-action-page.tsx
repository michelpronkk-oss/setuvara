import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { nameFontClasses } from "@/components/profile/name-fonts";
import { readPublicProfileMode } from "@/components/profile/public-profile-page";
import type { ModeSlug, ProfileMode } from "@/components/profile/types";
import { actionWindow } from "@/lib/actions/model";
import { getPublicActions } from "@/lib/actions/public";
import { actionTheme } from "@/lib/actions/theme";
import { createClient } from "@/lib/supabase/server";
import { createPublicProfileImageUrl } from "@/lib/supabase/public-profile-image-url";
import { ActionForm } from "./action-form";
import { ActionClosed, ActionPageView } from "./action-page-view";

export type ActionPageTarget = { username: string; slug: ModeSlug; backHref: string };

async function load(target: ActionPageTarget, actionId: string) {
  const [record, actions] = await Promise.all([readPublicProfileMode(target.username, target.slug), getPublicActions(target.username, target.slug)]);
  const found = actions.find((item) => item.action.id === actionId);
  return record && found ? { record, ...found } : null;
}

export async function publicActionMetadata(target: ActionPageTarget | null, actionId: string): Promise<Metadata> {
  const page = target ? await load(target, actionId) : null;
  if (!page) notFound();
  return { title: `${page.action.title} · ${page.record.profile.display_name}`, robots: { index: false, follow: false } };
}

/** One Action's page on any Mode: what it is, the terms, and the form, in the Mode's Appearance. */
export async function PublicActionPage({ target, actionId }: { target: ActionPageTarget | null; actionId: string }) {
  const page = target ? await load(target, actionId) : null;
  if (!target || !page) notFound();
  const { record, action, coverUrl } = page;
  const name = record.profile.display_name;
  const firstName = name.split(/\s+/)[0] || name;
  const supabase = await createClient();
  const [{ data: claims }, photoUrl] = await Promise.all([
    supabase.auth.getClaims(),
    record.mode.image_path ? createPublicProfileImageUrl(supabase, record.mode.image_path) : Promise.resolve(null),
  ]);
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  const { data: viewer } = userId ? await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle() : { data: null };
  const own = userId === record.profile.id;
  const theme = actionTheme({ slug: target.slug, appearance: record.mode.appearance as ProfileMode["appearance"] }, record.plan, Boolean(photoUrl));
  const responsesHref = target.slug === "creator" ? `/app/identity/creator/actions/${action.id}` : `/app/identity/actions/${action.id}`;

  return (
    <main className={`${marketingFontClasses} ${nameFontClasses} min-h-dvh`} style={{ background: theme.bg }}>
      <ActionPageView action={action} backHref={target.backHref} coverUrl={coverUrl} name={name} photoUrl={photoUrl} theme={theme}>
        {actionWindow(action) !== "open" ? <ActionClosed action={action} backHref={target.backHref} name={firstName} />
          : own ? (
            <div className="mt-8 rounded-[22px] bg-[var(--av-panel)] p-6 shadow-[inset_0_0_0_1px_var(--av-line)]">
              <p className="text-[17px] font-semibold">This is your own Action.</p>
              <p className="mt-2 text-[15px] text-[var(--av-muted)]">Responses land in your Actions.</p>
              <a className="mt-4 inline-flex min-h-11 items-center rounded-full px-[18px] text-[15px] font-semibold" href={responsesHref} style={{ background: "var(--av-btn-bg)", color: "var(--av-btn-fg)", boxShadow: "var(--av-btn-ring)" }}>Open responses</a>
            </div>
          ) : <ActionForm action={action} backHref={target.backHref} firstName={firstName} heading={theme.heading} motion={theme.motion} signedInName={viewer?.display_name ?? ""} />}
      </ActionPageView>
    </main>
  );
}
