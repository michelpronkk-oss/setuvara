"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getPublicOrigin } from "@/lib/app/viewer";
import { testimonialPath } from "@/lib/business/testimonials";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HREF = "/app/identity/testimonials";
const ERRORS: Record<string, string> = {
  rate_limited: "That's a lot of links today. Try again tomorrow.",
  lead_not_found: "This lead isn't here anymore.",
  business_not_found: "Turn on Business Mode first.",
};
const say = (message?: string) => Object.entries(ERRORS).find(([key]) => message?.includes(key))?.[1] ?? "That didn't go through. Try again.";

/** A private, single-use link to ask a client for a testimonial. The full link is shown once. */
export async function createTestimonialLink(leadId: string | null, name: string) {
  if (leadId !== null && !UUID.test(leadId)) return { ok: false as const, error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_testimonial_request", { p_lead_id: leadId, p_name: name.slice(0, 80) });
  if (error) return { ok: false as const, error: say(error.message) };
  const origin = await getPublicOrigin(await headers());
  revalidatePath(HREF);
  return { ok: true as const, url: `${origin}${testimonialPath((data as { token: string }).token)}` };
}

export async function revokeTestimonialLink(requestId: string) {
  if (!UUID.test(requestId)) return { ok: false as const, error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_testimonial_request", { p_request_id: requestId });
  if (error) return { ok: false as const, error: say(error.message) };
  revalidatePath(HREF);
  return { ok: true as const };
}

/** Approve shows it on Business Mode; hide takes it off; the database checks ownership. */
export async function setTestimonialStatus(id: string, status: "approved" | "hidden" | "pending") {
  if (!UUID.test(id)) return { ok: false as const, error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_testimonial_status", { p_id: id, p_status: status });
  if (error || data !== true) return { ok: false as const, error: say(error?.message) };
  revalidatePath(HREF);
  return { ok: true as const };
}

export async function deleteTestimonial(id: string) {
  if (!UUID.test(id)) return { ok: false as const, error: "Not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_testimonial", { p_id: id });
  if (error || data !== true) return { ok: false as const, error: say(error?.message) };
  revalidatePath(HREF);
  return { ok: true as const };
}
