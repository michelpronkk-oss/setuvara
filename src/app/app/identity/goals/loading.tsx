import { StudioSkeleton } from "@/components/app/studio-skeleton";

/** Studio pages load in their own shape; the app frame stays put. */
export default function Loading() {
  return <StudioSkeleton frame />;
}
