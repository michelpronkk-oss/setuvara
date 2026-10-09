import type { Metadata } from "next";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in · Setuvara", robots: { index: false } };

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const notice =
    query.error === "confirmation_failed"
      ? "This confirmation link is invalid or expired. Use the latest confirmation email, or log in below if your email is already confirmed."
      : query.error === "auth_callback"
        ? "We couldn’t complete that sign-in link. Try opening a fresh link or log in below."
        : undefined;

  return (
    <div className={marketingFontClasses}>
      <LoginForm notice={notice} />
    </div>
  );
}
