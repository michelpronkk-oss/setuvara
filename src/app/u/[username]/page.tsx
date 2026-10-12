import { permanentRedirect } from "next/navigation";

type LegacyProfileRouteProps = {
  params: Promise<{ username: string }>;
};

// Legacy links land on the canonical username URL. A `?mode=` query is not
// carried over: non-default Modes open only through an opaque share locator.
export default async function LegacyProfileRoute({ params }: LegacyProfileRouteProps) {
  const { username } = await params;
  permanentRedirect(`/${encodeURIComponent(username)}`);
}
