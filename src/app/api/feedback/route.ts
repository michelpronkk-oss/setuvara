import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getViewerPlan } from "@/lib/app/viewer";
import { FEEDBACK_KINDS, FEEDBACK_MAX_MESSAGE, FEEDBACK_MAX_SCREENSHOT, sniffScreenshot } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fieldsSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(1).max(FEEDBACK_MAX_MESSAGE),
  route: z.string().max(300).regex(/^\/[^\s]*$/).optional().catch(undefined),
  mode: z.enum(["personal", "event", "business"]).optional().catch(undefined),
  viewport: z.string().regex(/^[0-9]{2,5}x[0-9]{2,5}(@[0-9.]{1,4})?$/).optional().catch(undefined),
  locale: z.string().max(35).optional().catch(undefined),
});

/**
 * Stores one in-app feedback note for the signed-in member. Writes go through
 * the member's own session, so RLS keeps rows and screenshots in their name;
 * plan and browser are read here rather than trusted from the sheet.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return Response.json({ error: "Sign in to send feedback." }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "Feedback could not be read." }, { status: 400 }); }
  const field = (name: string) => { const value = form.get(name); return typeof value === "string" && value.length ? value : undefined; };
  const parsed = fieldsSchema.safeParse({ kind: field("kind"), message: field("message"), route: field("route"), mode: field("mode"), viewport: field("viewport"), locale: field("locale") });
  if (!parsed.success) return Response.json({ error: "Choose a type and write a short message." }, { status: 400 });

  let screenshotPath: string | null = null;
  const file = form.get("screenshot");
  if (file instanceof File && file.size > 0) {
    if (file.size > FEEDBACK_MAX_SCREENSHOT) return Response.json({ error: "Screenshots can be up to 4 MB." }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const image = sniffScreenshot(bytes);
    if (!image) return Response.json({ error: "Screenshots must be PNG, JPEG or WebP." }, { status: 415 });
    screenshotPath = `${userId}/${randomUUID()}.${image.extension}`;
    const { error } = await supabase.storage.from("product-feedback").upload(screenshotPath, bytes, { contentType: image.contentType, upsert: false });
    if (error) return Response.json({ error: "The screenshot didn’t upload. Try again, or send without it." }, { status: 502 });
  }

  const { plan } = await getViewerPlan(userId);
  const { error } = await supabase.from("product_feedback").insert({
    kind: parsed.data.kind,
    message: parsed.data.message,
    screenshot_path: screenshotPath,
    route: parsed.data.route ?? null,
    mode: parsed.data.mode ?? null,
    plan,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    viewport: parsed.data.viewport ?? null,
    locale: parsed.data.locale ?? null,
  });
  if (error) {
    const limited = error.message.includes("feedback_rate_limited");
    return Response.json({ error: limited ? "Thanks, that’s plenty for now. Try again in a few minutes." : "Feedback couldn’t be sent. Try again in a moment." }, { status: limited ? 429 : 500 });
  }
  return Response.json({ ok: true }, { status: 201 });
}

function sameOrigin(request: Request) {
  if (request.headers.get("x-setuvara-request") !== "same-origin") return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? new URL(request.url).protocol.replace(":", "");
  try { return new URL(origin).origin === (host ? `${protocol}://${host}` : new URL(request.url).origin); } catch { return false; }
}
