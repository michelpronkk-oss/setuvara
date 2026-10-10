import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { CelebrationClient, PassportDashboard, type PassportData } from "./passport-dashboard";
import { createClient } from "@/lib/supabase/server";
import { getViewerPlan } from "@/lib/app/viewer";

export default async function PassportPage() {
  const supabase = await createClient();
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "setuvara.com";
  const publicOrigin = /^(localhost|127\.0\.0\.1):(?:3000|3014)$/.test(requestHost) ? `http://${requestHost}` : "https://setuvara.com";
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (authError || !userId) redirect("/login?next=/app/passport");
  const [{ data: profile }, { data: result, error }, billing] = await Promise.all([
    supabase.from("profiles").select("username,display_name").eq("id", userId).maybeSingle(),
    supabase.rpc("get_passport_overview"),
    getViewerPlan(userId),
  ]);
  if (!profile || error || !result) return <PassportError />;
  const data = result as unknown as PassportData;
  const unseen = data.milestones.filter((item) => !item.seenAt).at(-1);
  return <><PassportDashboard initialData={data} username={profile.username} displayName={profile.display_name} plan={billing.plan} publicOrigin={publicOrigin} /><CelebrationClient threshold={unseen?.threshold ?? null} name={unseen ? milestoneName(unseen.threshold) : null} /></>;
}

function milestoneName(threshold: number) {
  return ({ 5: "First Circle", 10: "Ten Met", 25: "In Motion", 50: "Signal 50", 100: "Century", 250: "Connector", 500: "Network 500", 1000: "Thousand Met" } as Record<number, string>)[threshold] ?? "A new milestone";
}

function PassportError() {
  return <main className="grid min-h-screen place-items-center bg-[#f5f4ef] px-5 text-[#0d0d0d]"><section className="max-w-md rounded-[2rem] bg-white p-8"><h1 className="text-2xl font-semibold">Your Passport is taking a moment.</h1><p className="mt-2 text-sm leading-6 text-black/55">Refresh shortly to see your progress.</p><Link className="mt-5 inline-flex min-h-11 items-center underline underline-offset-4" href="/app/identity">Back to Identity</Link></section></main>;
}
