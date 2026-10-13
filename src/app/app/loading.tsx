import { RouteLoader } from "@/components/app/route-loader";

/** Any /app page without its own skeleton. Home keeps its exact skeleton in (home)/loading.tsx. */
export default function AppLoading() {
  return <RouteLoader />;
}
