import { cardFormat, NotFoundImage, profileOgImage } from "@/lib/seo/profile-og-image";
import { DEFAULT_PUBLIC_MODE } from "@/lib/share/mode-share";
import { normalizeUsername } from "@/lib/usernames";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileOgRouteProps = { params: Promise<{ username: string; mode: string }> };

// Only the default Mode has a predictable preview image. Event and Business
// previews are served from /og/s/<token> so their URL reveals nothing.
export async function GET(request: Request, { params }: ProfileOgRouteProps) {
  const { username: raw, mode } = await params;
  if (mode !== DEFAULT_PUBLIC_MODE) return NotFoundImage();
  const username = normalizeUsername(raw);
  return profileOgImage(username, DEFAULT_PUBLIC_MODE, { displayUrl: `setuvara.com/${username}`, format: cardFormat(request) });
}
