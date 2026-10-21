import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { signOut } from "@/app/app/identity/actions";
import { nameFontClasses } from "@/components/profile/name-fonts";
import { readFocus } from "@/components/profile/photo-focus";
import type { ModeSlug } from "@/components/profile/types";
import { NEEDS_ATTENTION } from "@/lib/actions/model";
import { actionsListHref, loadModeActions } from "@/lib/actions/studio-server";
import { signHomeImage } from "@/lib/app/media";
import { ActionsShell } from "./actions-shell";

/** The chrome around a non-Creator Mode's Actions pages. Creator's live inside the Creator studio. */
export async function ActionsFrame({ slug, page = "actions", children }: { slug: ModeSlug; page?: "actions" | "audience" | "events" | "leads" | "testimonials"; children: ReactNode }) {
  const data = await loadModeActions(slug, actionsListHref(slug));
  if (!data.mode) notFound();
  const { data: personal } = await data.supabase.from("profile_modes").select("image_path, image_focus_x, image_focus_y").eq("profile_id", data.userId).eq("slug", "personal").maybeSingle();
  const avatarUrl = await signHomeImage(data.supabase, personal?.image_path, true);
  const personalUrl = data.profile.username ? `${data.origin}/${data.profile.username}` : null;
  return (
    <div className={`${marketingFontClasses} ${nameFontClasses}`}>
      <ActionsShell
        avatarFocus={readFocus(personal?.image_focus_x, personal?.image_focus_y)}
        avatarUrl={avatarUrl}
        liveUrl={data.pageUrl ?? personalUrl ?? data.origin}
        modes={data.modes}
        needsYou={data.submissions.filter((item) => NEEDS_ATTENTION.includes(item.status)).length}
        page={page}
        pageUrl={data.pageUrl}
        personalUrl={personalUrl}
        plan={data.plan}
        profile={data.profile}
        signOut={signOut}
        slug={slug}
      >
        {children}
      </ActionsShell>
    </div>
  );
}
