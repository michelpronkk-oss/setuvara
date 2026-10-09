import { permanentRedirect } from "next/navigation";

type LegacyProfileRouteProps = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export default async function LegacyProfileRoute({ params, searchParams }: LegacyProfileRouteProps) {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  const destination = new URL(`/${encodeURIComponent(username)}`, "https://setuvara.com");

  if (query.mode) destination.searchParams.set("mode", query.mode);

  permanentRedirect(`${destination.pathname}${destination.search}`);
}
