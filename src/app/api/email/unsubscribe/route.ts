import { createClient } from "@/lib/supabase/server";

const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const validToken = (value: string | null): value is string => Boolean(value && /^[A-Za-z0-9_-]{43}$/.test(value));

function page(body: string, status = 200) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Setuvara email preferences</title><body style="margin:0;background:#F5F4EF;color:#0D0D0D;font:16px/1.6 Arial,sans-serif"><main style="max-width:520px;margin:12vh auto;padding:40px 28px;background:#fff;border-radius:24px"><p style="font-size:12px;font-weight:700;letter-spacing:.2em">setuvara</p>${body}</main></body></html>`, {
    status,
    headers: { ...noStore, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!validToken(token)) return page("<h1>Link unavailable</h1><p>This email preference link is invalid or has expired.</p>", 400);
  return page(`<h1 style="font-size:32px;line-height:1.1">Unsubscribe from these emails?</h1><p>This changes only this email category. Account security messages stay on.</p><form method="post"><input type="hidden" name="token" value="${token}"><button style="min-height:56px;padding:0 24px;border:0;border-radius:999px;background:#FF5A4F;color:#0D0D0D;font-weight:700;font-size:16px" type="submit">Unsubscribe</button></form>`);
}

export async function POST(request: Request) {
  let token = new URL(request.url).searchParams.get("token");
  try {
    const form = await request.formData();
    const posted = form.get("token");
    if (typeof posted === "string") token = posted;
  } catch {
    // One-click mail clients may send an empty form body; the scoped token stays in the URL.
  }
  if (!validToken(token)) return page("<h1>Link unavailable</h1><p>This email preference link is invalid or has expired.</p>", 400);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_email_unsubscribe", { p_token: token });
  if (error || data !== true) return page("<h1>Link unavailable</h1><p>This email preference link has already been used or has expired.</p>", 400);
  return page("<h1>You’re unsubscribed.</h1><p>Your account security emails will continue. You can change other preferences from your Setuvara settings.</p><a href=\"/login\" style=\"color:#0D0D0D;font-weight:700\">Go to Setuvara</a>");
}
