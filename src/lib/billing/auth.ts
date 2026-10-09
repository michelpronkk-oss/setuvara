import "server-only";

import { createClient } from "@/lib/supabase/server";

export type BillingUser = {
  id: string;
  email: string;
  displayName: string;
};

export async function getConfirmedBillingUser(): Promise<BillingUser | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.id || !user.email || !user.email_confirmed_at) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: profile.display_name?.trim() || "Setuvara member",
  };
}
