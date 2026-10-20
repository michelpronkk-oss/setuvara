import type { Metadata } from "next";

import { PublicActionPage, publicActionMetadata, type ActionPageTarget } from "@/components/actions/public-action-page";
import { resolveModeHandle } from "@/lib/handles/mode-server";
import { getPublishedPublicMode } from "@/lib/seo/public-profile";
import { DEFAULT_PUBLIC_MODE } from "@/lib/share/mode-share";
import { isAllowedUsername, normalizeUsername } from "@/lib/usernames";

type Props = { params: Promise<{ username: string; actionId: string }> };

// Same namespace as setuvara.com/<name>: a username's default Mode, else a live Business or Creator handle.
async function target(raw: string): Promise<ActionPageTarget | null> {
  const name = normalizeUsername(raw);
  if (!isAllowedUsername(name)) return null;
  if (await getPublishedPublicMode(name, DEFAULT_PUBLIC_MODE)) return { username: name, slug: DEFAULT_PUBLIC_MODE, backHref: `/${name}` };
  const handle = await resolveModeHandle(name);
  return handle ? { username: handle.username, slug: handle.slug, backHref: `/${handle.handle}` } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, actionId } = await params;
  return publicActionMetadata(await target(username), actionId);
}

/** An Action on a Personal page, or on a Business or Creator handle. */
export default async function UsernameActionPage({ params }: Props) {
  const { username, actionId } = await params;
  return <PublicActionPage actionId={actionId} target={await target(username)} />;
}
