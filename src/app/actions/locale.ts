"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/locale";

function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/u.test(value)) return "/";
  try {
    const url = new URL(value, "https://setuvara.com");
    if (url.origin !== "https://setuvara.com") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export async function setLocaleAction(formData: FormData): Promise<never> {
  const locale = normalizeLocale(formData.get("locale"));
  if (!locale) redirect(safeReturnPath(formData.get("returnTo")));

  let returnPath = safeReturnPath(formData.get("returnTo"));
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = !error && typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;

  if (userId) {
    const { error: saveError } = await supabase.rpc("set_account_locale", { p_locale: locale });
    if (saveError) redirect("/app/settings/language?status=error");
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  // The root marketing page is intentionally English/x-default. Dutch has an
  // explicit canonical route; never let a cookie turn `/` into Dutch content.
  if (returnPath === "/" || returnPath === "/nl") {
    returnPath = locale === "nl" ? "/nl" : "/";
  }
  redirect(returnPath);
}
