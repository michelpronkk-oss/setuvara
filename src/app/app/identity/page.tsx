import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { addLink, deleteLink, saveIdentity, setPublished, signOut } from "./actions";

type IdentityPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

const errorMessages: Record<string, string> = {
  invalid_username: "Use a username with 3–24 lowercase letters, numbers, or underscores.",
  invalid_identity: "Check your display name and bio lengths.",
  username_taken: "That username is already in use.",
  invalid_link: "Enter a valid link title and an HTTP or HTTPS URL.",
  save_failed: "Your identity couldn’t be saved. Please try again.",
  link_failed: "The link couldn’t be updated. Please try again.",
  publish_failed: "Your publishing status couldn’t be changed. Please try again.",
};

const savedMessages: Record<string, string> = {
  identity: "Identity saved.",
  link: "Link added.",
  link_removed: "Link removed.",
  published: "Your public profile is live.",
  unpublished: "Your public profile is now private.",
};

export default async function IdentityEditorPage({ searchParams }: IdentityPageProps) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login?next=/app/identity");
  }

  const [profileResult, modesResult, linksResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, bio, is_published")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("profile_modes")
      .select("id, slug, label, sort_order, is_enabled")
      .eq("profile_id", userId)
      .order("sort_order"),
    supabase
      .from("profile_links")
      .select("id, mode_id, title, url, sort_order")
      .eq("profile_id", userId)
      .order("sort_order"),
  ]);

  if (profileResult.error || modesResult.error || linksResult.error || !profileResult.data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-5 py-16">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800">Setuvara</p>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">Identity setup is waiting</h1>
          <p className="mt-2 text-slate-600">
            Your identity database migration needs to be applied before this editor is available.
          </p>
          <form action={signOut} className="mt-6">
            <button className="font-semibold text-emerald-800 underline underline-offset-4" type="submit">
              Sign out
            </button>
          </form>
        </section>
      </main>
    );
  }

  const profile = profileResult.data;
  const modes = modesResult.data ?? [];
  const links = linksResult.data ?? [];
  const errorMessage = query.error ? errorMessages[query.error] : undefined;
  const savedMessage = query.saved ? savedMessages[query.saved] : undefined;

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Link className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800" href="/">
            Setuvara
          </Link>
          <form action={signOut}>
            <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white" type="submit">
              Sign out
            </button>
          </form>
        </header>

        <section className="mt-12 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Identity editor</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Make it yours.</h1>
          <p className="mt-3 text-lg leading-8 text-slate-600">
            One identity, with the right context for each connection.
          </p>
        </section>

        {(errorMessage || savedMessage) && (
          <p
            aria-live="polite"
            className={`mt-8 rounded-xl px-4 py-3 text-sm ${
              errorMessage ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-900"
            }`}
          >
            {errorMessage ?? savedMessage}
          </p>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-950">Your identity</h2>
              <p className="mt-1 text-sm text-slate-500">This is the foundation for every mode you share.</p>
            </div>
            <form action={saveIdentity} className="space-y-5">
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                Username
                <span className="flex items-center rounded-xl border border-slate-300 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
                  <span className="pl-4 text-slate-400">@</span>
                  <input
                    autoComplete="username"
                    className="w-full rounded-r-xl px-2 py-3 text-base font-normal outline-none"
                    defaultValue={profile.username}
                    maxLength={24}
                    minLength={3}
                    name="username"
                    pattern="[a-z0-9_]{3,24}"
                    required
                  />
                </span>
              </label>
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                Display name
                <input
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  defaultValue={profile.display_name}
                  maxLength={80}
                  name="displayName"
                  required
                />
              </label>
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                Bio
                <textarea
                  className="min-h-28 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-base font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  defaultValue={profile.bio}
                  maxLength={280}
                  name="bio"
                  placeholder="A few words about you"
                  rows={4}
                />
              </label>
              <button className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white hover:bg-emerald-900" type="submit">
                Save identity
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold text-slate-950">Modes</h2>
            <p className="mt-1 text-sm text-slate-500">Choose which version of your identity fits the moment.</p>
            <div className="mt-5 space-y-3">
              {modes.map((mode) => (
                <div className="rounded-2xl border border-slate-200 px-4 py-4" key={mode.id}>
                  <p className="font-semibold text-slate-900">{mode.label}</p>
                  <p className="mt-1 text-sm capitalize text-slate-500">{mode.slug} mode</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Links</h2>
            <p className="mt-1 text-sm text-slate-500">Keep links relevant to each mode.</p>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {modes.map((mode) => (
              <div className="rounded-2xl bg-slate-50 p-5" key={mode.id}>
                <h3 className="font-semibold text-slate-900">{mode.label}</h3>
                <ul className="mt-3 space-y-2">
                  {links
                    .filter((link) => link.mode_id === mode.id)
                    .map((link) => (
                      <li className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2" key={link.id}>
                        <a className="min-w-0 truncate text-sm font-medium text-emerald-800 underline-offset-4 hover:underline" href={link.url} rel="noreferrer" target="_blank">
                          {link.title}
                        </a>
                        <form action={deleteLink}>
                          <input name="linkId" type="hidden" value={link.id} />
                          <button aria-label={`Remove ${link.title}`} className="text-xs font-semibold text-slate-500 hover:text-rose-700" type="submit">
                            Remove
                          </button>
                        </form>
                      </li>
                    ))}
                </ul>
                <form action={addLink} className="mt-4 space-y-2">
                  <input name="modeId" type="hidden" value={mode.id} />
                  <input
                    aria-label={`${mode.label} link title`}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
                    maxLength={60}
                    name="title"
                    placeholder="Link title"
                    required
                  />
                  <input
                    aria-label={`${mode.label} link URL`}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
                    name="url"
                    placeholder="https://example.com"
                    required
                    type="url"
                  />
                  <button className="rounded-lg border border-emerald-800 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50" type="submit">
                    Add link
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Publish your profile</h2>
            <p className="mt-1 text-sm text-slate-500">
              {profile.is_published
                ? "Your profile is public and ready to share."
                : "Your profile stays private until you publish it."}
            </p>
            {profile.is_published && (
              <Link className="mt-3 inline-block font-semibold text-emerald-800 underline underline-offset-4" href={`/${profile.username}`}>
                View your public profile
              </Link>
            )}
          </div>
          <form action={setPublished}>
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                className="size-5 accent-emerald-800"
                defaultChecked={profile.is_published}
                name="published"
                type="checkbox"
              />
              Public profile
            </label>
            <button className="mt-4 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800" type="submit">
              Save publishing status
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
