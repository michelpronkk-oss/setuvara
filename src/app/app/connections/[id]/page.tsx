import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ConnectionDetail } from "@/components/connections/detail/connection-detail";
import { loadRelationship } from "@/lib/connections/load-relationship";
import { createClient } from "@/lib/supabase/server";

type ConnectionDetailProps = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Connection · Setuvara", robots: { index: false } };

export default async function ConnectionDetailPage({ params }: ConnectionDetailProps) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (claimsError || !userId) redirect(`/login?next=${encodeURIComponent(`/app/connections/${id}`)}`);
  const guestSessionToken = (await cookies()).get("sv-guest-session")?.value;
  if (guestSessionToken) await supabase.rpc("claim_guest_connections", { p_session_token: guestSessionToken });

  const relationship = await loadRelationship(supabase, userId, id);
  if (!relationship) notFound();
  // The client gets a signed URL, never the storage path.
  const model = { ...relationship.model, person: { ...relationship.model.person, photoPath: null } };

  return <ConnectionDetail model={model} photoUrl={relationship.photoUrl} viewerId={userId} />;
}
