import { NotFoundImage, profileOgImage } from "@/lib/seo/profile-og-image";
import { modeShareTokenPattern, parseResolvedModeShare } from "@/lib/share/mode-share";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ModeShareOgRouteProps = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: ModeShareOgRouteProps) {
  const { token } = await params;
  if (!modeShareTokenPattern.test(token)) return NotFoundImage();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("resolve_mode_share", { p_token: token });
    const resolved = error ? null : parseResolvedModeShare(data);
    return resolved ? profileOgImage(resolved.username, resolved.mode) : NotFoundImage();
  } catch {
    return NotFoundImage();
  }
}
