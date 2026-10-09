import type { Metadata } from "next";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { SignupFlow } from "@/components/auth/signup-flow";

export const metadata: Metadata = { title: "Claim your name · Setuvara", robots: { index: false } };

type SignupPageProps = {
  searchParams: Promise<{ claim?: string; username?: string | string[]; handle?: string | string[] }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const query = await searchParams;
  const requested = [query.username, query.handle].find((value): value is string => typeof value === "string") ?? "";
  return (
    <div className={marketingFontClasses}>
      <SignupFlow claimGuest={query.claim === "1"} initialHandle={requested.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24)} />
    </div>
  );
}
