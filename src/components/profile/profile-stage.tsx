import type { ReactNode } from "react";

/**
 * Where the public profile sits in the window. It runs edge to edge at every size: phones keep
 * their own composition, and from 900px the renderer switches to each Appearance's wide hero and,
 * from 1100px, to the editorial spread. Kept as a seam (with the page's look passed in) so the
 * stage can change without touching the two pages that use it.
 */
export function ProfileStage({ children }: { photo: string | null; base: string; accent: string; dark: boolean; children: ReactNode }) {
  return <div className="relative" data-profile-stage>{children}</div>;
}
