import { cardFormat, NotFoundImage, profileOgImage } from "@/lib/seo/profile-og-image";
import { modeShareTokenPattern, parseResolvedModeShare } from "@/lib/share/mode-share";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ModeShareOgRouteProps = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: ModeShareOgRouteProps) {
  const { token } = await params;
  if (!modeShareTokenPattern.test(token)) return NotFoundImage();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("resolve_mode_share", { p_token: token });
    const resolved = error ? null : parseResolvedModeShare(data);
    // A share link prints only itself: long legacy tokens are shortened on the card.
    const shown = token.length > 12 ? `${token.slice(0, 8)}…` : token;
    return resolved ? profileOgImage(resolved.username, resolved.mode, { displayUrl: `setuvara.com/s/${shown}`, format: cardFormat(request) }) : NotFoundImage();
  } catch {
    return NotFoundImage();
  }
}
