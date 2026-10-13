import type { Metadata } from "next";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { SignupFlow } from "@/components/auth/signup-flow";
import { appearanceHint } from "@/components/profile/appearance";
import { upgradePath } from "@/lib/billing/intent";

export const metadata: Metadata = { title: "Claim your name · Setuvara", robots: { index: false, follow: false }, openGraph: null, twitter: null };

type SignupPageProps = {
  searchParams: Promise<{ claim?: string; username?: string | string[]; handle?: string | string[]; appearance?: string | string[]; plan?: string | string[]; interval?: string | string[] }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const query = await searchParams;
  const requested = [query.username, query.handle].find((value): value is string => typeof value === "string") ?? "";
  return (
    <div className={marketingFontClasses}>
      {/* ?appearance= from "Make yours" is only a validated hint; it never grants a Plus look. */}
      {/* ?plan= from Pricing only chooses where to land; checkout still needs the member's own confirmation. */}
      <SignupFlow appearance={appearanceHint(query.appearance)} next={upgradePath(query.plan, query.interval) ?? "/app"} claimGuest={query.claim === "1"} initialHandle={requested.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24)} />
    </div>
  );
}
