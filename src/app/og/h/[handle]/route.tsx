import { resolveModeHandle } from "@/lib/handles/mode-server";
import { cardFormat, NotFoundImage, profileOgImage } from "@/lib/seo/profile-og-image";
import { usernamePattern } from "@/lib/usernames";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ModeHandleOgRouteProps = { params: Promise<{ handle: string }> };

// Link preview for a live Business or Creator handle; nothing for one that isn't live.
export async function GET(request: Request, { params }: ModeHandleOgRouteProps) {
  const { handle } = await params;
  if (!usernamePattern.test(handle)) return NotFoundImage();
  const resolved = await resolveModeHandle(handle);
  return resolved
    ? profileOgImage(resolved.username, resolved.slug, { displayUrl: `setuvara.com/${handle}`, handle, format: cardFormat(request) })
    : NotFoundImage();
}
