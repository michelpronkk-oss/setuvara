import { RouteLoader } from "@/components/app/route-loader";

/** The editor is a full-screen workspace without the app header, so the loader fills the screen too. */
export default function IdentityLoading() {
  return <RouteLoader fullscreen />;
}
