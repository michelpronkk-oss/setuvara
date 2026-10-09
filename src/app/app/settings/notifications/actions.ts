"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function saveNotificationPreferences(formData: FormData) {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (error || !userId) redirect("/login?next=/app/settings/notifications");

  const { error: saveError } = await supabase.from("notification_preferences").upsert({
    user_id: userId,
    connection_emails: formData.get("connection_emails") === "on",
    connection_recaps: formData.get("connection_recaps") === "on",
    passport_milestones: formData.get("passport_milestones") === "on",
    passport_stamps: formData.get("passport_stamps") === "on",
    lifecycle_emails: formData.get("lifecycle_emails") === "on",
    product_updates: formData.get("product_updates") === "on",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (saveError) redirect("/app/settings/notifications?error=save");
  revalidatePath("/app/settings/notifications");
  redirect("/app/settings/notifications?saved=1");
}
