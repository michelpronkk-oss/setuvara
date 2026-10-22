import { StudioSkeleton } from "@/components/app/studio-skeleton";

/** Any /app page without its own skeleton. Home keeps its exact skeleton in (home)/loading.tsx. */
export default function AppLoading() {
  return <StudioSkeleton />;
}
