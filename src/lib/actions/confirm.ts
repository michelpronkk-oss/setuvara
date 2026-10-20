import "server-only";

import { createHash } from "node:crypto";

import type { ModeSlug, ProfileMode } from "@/components/profile/types";
import { getUserBillingState } from "@/lib/billing/service";
import { publicModePath } from "@/lib/share/mode-share";
import { createClient } from "@/lib/supabase/server";
import { createPublicProfileImageUrl } from "@/lib/supabase/public-profile-image-url";
import type { ActionKind } from "./model";
import { createActionsServiceClient } from "./server";
import { actionTheme, type ActionTheme } from "./theme";

export type ConfirmTarget = { kind: ActionKind; title: string; name: string; theme: ActionTheme; photoUrl: string | null; backHref: string | null };

/**
 * What the emailed link belongs to, so the confirm page wears that Mode's Appearance. Reads only the
 * Action's public face; the token itself confirms nothing until the visitor presses the button.
 */
export async function loadConfirmTarget(token: string): Promise<ConfirmTarget | null> {
  try {
    const service = createActionsServiceClient();
    const hash = createHash("sha256").update(token).digest("hex");
    const { data: entry } = await service.from("action_submissions").select("action_id").eq("verify_token_hash", `\\x${hash}`).maybeSingle();
    if (!entry) return null;
    const { data: action } = await service.from("profile_actions").select("kind, title, profile_id, profile_modes(slug, appearance, image_path)").eq("id", entry.action_id).maybeSingle();
    const mode = action?.profile_modes as unknown as { slug: ModeSlug; appearance: ProfileMode["appearance"]; image_path: string | null } | null;
    if (!action || !mode) return null;
    const [{ data: profile }, billing] = await Promise.all([
      service.from("profiles").select("username, display_name").eq("id", action.profile_id).maybeSingle(),
      getUserBillingState(action.profile_id).catch(() => null),
    ]);
    const supabase = await createClient();
    const [photoUrl, backHref] = await Promise.all([
      mode.image_path ? createPublicProfileImageUrl(supabase, mode.image_path) : Promise.resolve(null),
      profile?.username ? publicModePath(action.profile_id, profile.username, mode.slug).catch(() => null) : Promise.resolve(null),
    ]);
    return {
      kind: action.kind as ActionKind,
      title: action.title,
      name: profile?.display_name ?? "",
      theme: actionTheme(mode, billing?.plan ?? "free", Boolean(photoUrl)),
      photoUrl,
      backHref,
    };
  } catch {
    return null;
  }
}
