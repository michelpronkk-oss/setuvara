"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalizeCountryCode } from "@/lib/i18n/countries";
import { createClient } from "@/lib/supabase/server";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const contextSchema = z.object({
  type: z.enum(["event", "meeting", "place", "custom"]),
  label: z.string().trim().min(1).max(120),
  venue: optionalText(120),
  city: optionalText(80),
  countryCode: z.string().trim().max(2).transform((value) => value ? normalizeCountryCode(value) : null),
  startsAt: z.string().trim().max(40).transform((value) => value || null),
  expiresAt: z.string().datetime({ offset: true }),
  saveForLater: z.boolean(),
}).superRefine((value, context) => {
  if (value.startsAt && Date.parse(value.startsAt) >= Date.parse(value.expiresAt)) {
    context.addIssue({ code: "custom", path: ["startsAt"], message: "Start must be before the end." });
  }
});

async function authenticatedUser() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = !error && typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  return { supabase, userId };
}

export async function saveActiveLiveContext(formData: FormData): Promise<{ ok: boolean; message?: string }> {
  const rawCountry = String(formData.get("countryCode") ?? "").trim();
  const parsed = contextSchema.safeParse({
    type: formData.get("type"),
    label: formData.get("label"),
    venue: formData.get("venue") ?? "",
    city: formData.get("city") ?? "",
    countryCode: rawCountry,
    startsAt: formData.get("startsAt") ?? "",
    expiresAt: formData.get("expiresAt"),
    saveForLater: formData.get("saveForLater") === "on",
  });
  if (!parsed.success || (rawCountry && !normalizeCountryCode(rawCountry))) {
    return { ok: false, message: "Check the context details and try again." };
  }

  const { supabase, userId } = await authenticatedUser();
  if (!userId) return { ok: false, message: "Sign in to set a Live Context." };
  const { error } = await supabase.rpc("set_active_live_context", {
    p_context_type: parsed.data.type,
    p_label: parsed.data.label,
    p_expires_at: parsed.data.expiresAt,
    p_venue: parsed.data.venue,
    p_city: parsed.data.city,
    p_country_code: parsed.data.countryCode,
    p_starts_at: parsed.data.startsAt,
    p_source: "manual",
    p_is_saved: parsed.data.saveForLater,
  });
  if (error) return { ok: false, message: "This context could not be saved. Check the details and try again." };

  revalidatePath("/app/context");
  revalidatePath("/app");
  revalidatePath("/app/connections");
  return { ok: true };
}

export async function endActiveLiveContext(contextId: string): Promise<{ ok: boolean }> {
  const id = z.string().uuid().safeParse(contextId);
  if (!id.success) return { ok: false };
  const { supabase, userId } = await authenticatedUser();
  if (!userId) return { ok: false };
  const { data, error } = await supabase.from("live_contexts")
    .update({ is_active: false })
    .eq("id", id.data)
    .eq("owner_user_id", userId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false };
  revalidatePath("/app/context");
  revalidatePath("/app");
  return { ok: true };
}
