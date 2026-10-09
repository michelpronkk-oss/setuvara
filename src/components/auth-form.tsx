"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { isAllowedUsername, normalizeUsername } from "@/lib/usernames";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      const supabase = createClient();

      if (isSignup) {
        const normalizedUsername = normalizeUsername(username);
        const normalizedDisplayName = displayName.trim();

        if (!isAllowedUsername(normalizedUsername)) {
          setMessage("Choose a username with 3–24 letters, numbers, or underscores.");
          return;
        }

        if (!normalizedDisplayName || normalizedDisplayName.length > 80) {
          setMessage("Enter a display name of 1–80 characters.");
          return;
        }

        const { data: available, error: availabilityError } = await supabase.rpc(
          "is_username_available",
          { candidate_username: normalizedUsername },
        );

        if (availabilityError) {
          setMessage("Username availability is temporarily unavailable. Try again shortly.");
          return;
        }

        if (!available) {
          setMessage("That username is unavailable. Try another one.");
          return;
        }

        const confirmationUrl = new URL("/auth/confirm", window.location.origin);
        confirmationUrl.searchParams.set("next", "/app/identity");

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: normalizedUsername,
              display_name: normalizedDisplayName,
            },
            emailRedirectTo: confirmationUrl.toString(),
          },
        });

        if (error) {
          setMessage("We couldn’t create the account. Check your details and try again.");
          return;
        }

        if (data.session) {
          router.replace("/app/identity");
          router.refresh();
          return;
        }

        setMessage("Check your email to confirm your account and finish setting up your identity.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage("We couldn’t sign you in. Check your email and password.");
        return;
      }

      router.replace("/app/identity");
      router.refresh();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {isSignup && (
        <>
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            Display name
            <input
              autoComplete="name"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-normal outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              maxLength={80}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              value={displayName}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            Username
            <span className="flex items-center rounded-xl border border-slate-300 bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
              <span className="pl-4 text-slate-400">@</span>
              <input
                autoComplete="username"
                className="w-full rounded-r-xl bg-transparent px-2 py-3 text-base font-normal outline-none"
                maxLength={24}
                onChange={(event) => setUsername(event.target.value)}
                pattern="[A-Za-z0-9_]{3,24}"
                required
                value={username}
              />
            </span>
            <span className="block text-xs font-normal text-slate-500">
              Your public address will be setuvara.com/your-username.
            </span>
          </label>
        </>
      )}

      <label className="block space-y-2 text-sm font-medium text-slate-700">
        Email
        <input
          autoComplete="email"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-normal outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      <label className="block space-y-2 text-sm font-medium text-slate-700">
        Password
        <input
          autoComplete={isSignup ? "new-password" : "current-password"}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-normal outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      {message && (
        <p aria-live="polite" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </p>
      )}

      <button
        className="w-full rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={busy}
        type="submit"
      >
        {busy ? "Please wait…" : isSignup ? "Create your identity" : "Sign in"}
      </button>

      <p className="text-center text-sm text-slate-600">
        {isSignup ? "Already have an account? " : "New to Setuvara? "}
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-emerald-800 underline-offset-4 hover:underline"
          href={isSignup ? "/login" : "/signup"}
        >
          {isSignup ? "Sign in" : "Create an identity"}
        </Link>
      </p>
    </form>
  );
}
