import type { Metadata } from "next";

import { PublicActionPage, publicActionMetadata, type ActionPageTarget } from "@/components/actions/public-action-page";
import { resolveModeShare } from "../../resolve";

type Props = { params: Promise<{ token: string; actionId: string }> };

async function target(token: string): Promise<ActionPageTarget | null> {
  const resolved = await resolveModeShare(token);
  return resolved ? { username: resolved.username, slug: resolved.slug, backHref: `/s/${token}` } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token, actionId } = await params;
  return publicActionMetadata(await target(token), actionId);
}

/** An Action behind a Mode's share link, on any Mode. */
export default async function ShareActionPage({ params }: Props) {
  const { token, actionId } = await params;
  return <PublicActionPage actionId={actionId} target={await target(token)} />;
}
