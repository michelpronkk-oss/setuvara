import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { PublicTestimonial } from "./testimonials";

/** A Business Mode's approved testimonials, as many as the owner's plan shows, as any visitor may see them. */
export const getPublicTestimonials = cache(async (username: string): Promise<PublicTestimonial[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_testimonials", { p_username: username });
  return error || !Array.isArray(data) ? [] : (data as PublicTestimonial[]);
});
