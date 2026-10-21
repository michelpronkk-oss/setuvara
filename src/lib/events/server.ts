import "server-only";

import { cache } from "react";

import type { ProfileMode } from "@/components/profile/types";
import { readPublicProfileMode } from "@/components/profile/public-profile-page";
import { createActionsServiceClient } from "@/lib/actions/server";
import { actionTheme } from "@/lib/actions/theme";
import { publicModePath } from "@/lib/share/mode-share";
import { createClient } from "@/lib/supabase/server";
import { createPublicProfileImageUrl } from "@/lib/supabase/public-profile-image-url";
import { SHORT_ID, type PublicEvent } from "./model";

export { createActionsServiceClient as createEventsServiceClient };

/** Event pages and registration stay closed until this is set, so merging never opens them by itself. */
export function eventsEnabled() {
  return process.env.EVENTS_ENABLED === "true";
}

/**
 * A public event with what its page needs to wear the organizer's Event Mode: the theme, the Mode's
 * photo and a link back to the Event Mode page (its /s/ link, never the username).
 */
export const loadPublicEvent = cache(async (shortId: string) => {
  if (!eventsEnabled() || !SHORT_ID.test(shortId)) return null;
  let service;
  try { service = createActionsServiceClient(); } catch { return null; }
  const { data } = await service.rpc("get_public_event", { p_short_id: shortId });
  const event = data as PublicEvent | null;
  if (!event) return null;
  const record = await readPublicProfileMode(event.username, "event");
  if (!record) return null;
  const supabase = await createClient();
  const [photoUrl, backHref] = await Promise.all([
    record.mode.image_path ? createPublicProfileImageUrl(supabase, record.mode.image_path) : Promise.resolve(null),
    publicModePath(event.profile_id, event.username, "event").catch(() => null),
  ]);
  const theme = actionTheme({ slug: "event", appearance: record.mode.appearance as ProfileMode["appearance"] }, record.plan, Boolean(photoUrl));
  return { event, organizer: record.profile.display_name, photoUrl, backHref, theme };
});
