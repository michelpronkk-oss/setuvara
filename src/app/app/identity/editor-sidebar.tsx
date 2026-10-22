"use client";

import { AccountMenu } from "@/components/app/app-shell";
import { SettingsLink, SideNav, type ModePage } from "@/components/app/side-nav";
import type { PhotoFocus } from "@/components/profile/photo-focus";
import type { ModeSlug, ProfileIdentity } from "@/components/profile/types";
import type { PlanCode } from "@/lib/billing/catalog";
import type { StudioPageId } from "@/components/app/nav-icons";
import type { Section } from "./editor-types";

export { EventsIcon, LeadsIcon, SectionIcon, STUDIO_PAGES, StudioIcon, StudioMark, TeamIcon, TestimonialsIcon, type StudioPageId } from "@/components/app/nav-icons";

/**
 * Every Mode page's desktop sidebar: the shared Setuvara sidebar with this Mode open. The Mode's page
 * sections (Profile, Content, Appearance, Share, Settings) are tabs in the editor itself.
 */
export function EditorSidebar({ profile, modes, slug, studio = null, actions = false, audience = false, events = false, leads = false, testimonials = false, team = false, builder = false, needsYou = 0, plan, liveUrl, personalUrl, avatarUrl, avatarFocus, onGo, inPlace = false, signOut }: {
  profile: ProfileIdentity; modes: { slug: ModeSlug; is_enabled: boolean }[]; slug: ModeSlug; section: Section | null;
  studio?: StudioPageId | null; /** The Mode's Actions page is open (Personal, Event, Business). */ actions?: boolean; /** The Audience page is open (Personal, Event, Business). */ audience?: boolean; /** Event Mode's Events page is open. */ events?: boolean; /** Business Mode's Leads page is open. */ leads?: boolean; /** Business Mode's Testimonials page is open. */ testimonials?: boolean; /** Business Mode's Team page is open. */ team?: boolean; /** Business Mode's Builder page is open. */ builder?: boolean; needsYou?: number; plan: PlanCode; liveUrl: string; personalUrl: string | null;
  avatarUrl: string | null; avatarFocus?: PhotoFocus; onGo: (section: Section, mode?: ModeSlug) => void;
  /** The Mode editor switches Mode and opens its Overview without a page load. Elsewhere a Mode row is a link to its Overview. */
  inPlace?: boolean; signOut: () => Promise<void>;
}) {
  const page: ModePage = studio ?? (events ? "events" : leads ? "leads" : testimonials ? "testimonials" : team ? "team" : builder ? "builder" : actions ? "actions" : audience ? "audience" : "overview");
  return (
    <SideNav
      footer={<><SettingsLink current={false} /><AccountMenu avatarFocus={avatarFocus} avatarUrl={avatarUrl} displayName={profile.display_name || "Your identity"} placement="panel" plan={plan} publicProfileUrl={personalUrl} signOut={signOut} username={profile.username || null} /></>}
      liveUrl={liveUrl}
      modes={modes.map((mode) => ({ slug: mode.slug, enabled: mode.is_enabled }))}
      needsYou={needsYou}
      onModeGo={inPlace ? (next) => onGo("home", next) : undefined}
      place={{ mode: slug, page }}
      published={profile.is_published}
    />
  );
}
