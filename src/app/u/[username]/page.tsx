import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type PublicProfilePageProps = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export default async function PublicProfilePage({ params, searchParams }: PublicProfilePageProps) {
  const [{ username: rawUsername }, query] = await Promise.all([params, searchParams]);
  const username = rawUsername.toLowerCase();

  if (!/^[a-z0-9_]{3,24}$/.test(username)) notFound();

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio")
    .eq("username", username)
    .eq("is_published", true)
    .maybeSingle();

  if (profileError || !profile) notFound();

  const { data: modes, error: modesError } = await supabase
    .from("profile_modes")
    .select("id, slug, label, sort_order")
    .eq("profile_id", profile.id)
    .eq("is_enabled", true)
    .order("sort_order");

  if (modesError || !modes?.length) notFound();

  const activeMode = modes.find((mode) => mode.slug === query.mode) ?? modes[0];
  const { data: links } = await supabase
    .from("profile_links")
    .select("id, title, url, sort_order")
    .eq("profile_id", profile.id)
    .eq("mode_id", activeMode.id)
    .eq("is_visible", true)
    .order("sort_order");

  return (
    <main className="flex min-h-screen justify-center px-5 py-14 sm:py-20">
      <article className="w-full max-w-xl">
        <Link className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800" href="/">
          Setuvara
        </Link>
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-2xl font-semibold text-emerald-900">
            {profile.display_name.slice(0, 1).toUpperCase()}
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
            {profile.display_name}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">@{profile.username}</p>
          {profile.bio && <p className="mt-5 whitespace-pre-wrap leading-7 text-slate-700">{profile.bio}</p>}

          <nav aria-label="Profile modes" className="mt-8 flex gap-2 border-b border-slate-200">
            {modes.map((mode) => (
              <Link
                aria-current={activeMode.id === mode.id ? "page" : undefined}
                className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold ${
                  activeMode.id === mode.id
                    ? "border-emerald-800 text-emerald-900"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
                href={`/u/${profile.username}?mode=${mode.slug}`}
                key={mode.id}
              >
                {mode.label}
              </Link>
            ))}
          </nav>

          <div className="mt-5 space-y-3">
            {links?.map((link) => (
              <a
                className="flex items-center justify-between rounded-2xl border border-slate-200 px-5 py-4 font-semibold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50"
                href={link.url}
                key={link.id}
                rel="noreferrer"
                target="_blank"
              >
                {link.title}
                <span aria-hidden="true" className="text-emerald-800">↗</span>
              </a>
            ))}
            {!links?.length && (
              <p className="rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-500">
                This mode has no links yet.
              </p>
            )}
          </div>
        </section>
        <p className="mt-6 text-center text-xs text-slate-400">Shared with Setuvara</p>
      </article>
    </main>
  );
}
