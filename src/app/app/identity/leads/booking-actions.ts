"use server";

import { revalidatePath } from "next/cache";

import { BUFFER_MINUTES, SLOT_MINUTES, weeklyProblem, type BookingAvailability } from "@/lib/business/bookings";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERRORS: Record<string, string> = {
  horizon_over_plan: "Booking that far ahead is part of a higher plan.",
  invalid_timezone: "Pick a time zone from the list.",
  invalid_hours: "Check the hours: each range has to end after it starts.",
  not_a_booking: "Times work on booking requests, not applications.",
  action_not_found: "This Action isn't here anymore.",
};
const say = (message?: string) => Object.entries(ERRORS).find(([key]) => message?.includes(key))?.[1] ?? "That didn't save. Try again.";

/** Saves a Booking Action's hours. The database re-checks every value and caps the horizon by plan. */
export async function saveBookingHours(input: Omit<BookingAvailability, "weekly"> & { weekly: BookingAvailability["weekly"] }, path: string) {
  if (!UUID.test(input.action_id)) return { ok: false as const, error: "Not found." };
  if (!(SLOT_MINUTES as readonly number[]).includes(input.slot_minutes) || !(BUFFER_MINUTES as readonly number[]).includes(input.buffer_minutes)) return { ok: false as const, error: "Pick a length and a buffer from the list." };
  const problem = weeklyProblem(input.weekly);
  if (problem) return { ok: false as const, error: problem };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_booking_availability", {
    p_action_id: input.action_id, p_enabled: input.enabled, p_timezone: input.timezone, p_slot_minutes: input.slot_minutes,
    p_buffer_minutes: input.buffer_minutes, p_notice_hours: input.notice_hours, p_horizon_days: input.horizon_days, p_weekly: input.weekly,
  });
  if (error) return { ok: false as const, error: say(error.message) };
  if (path.startsWith("/app/")) revalidatePath(path);
  revalidatePath("/app/identity/leads");
  return { ok: true as const };
}
