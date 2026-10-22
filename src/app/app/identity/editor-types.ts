import type { ModeHandleSlug, ModeHandleState } from "@/lib/handles/mode-handle";
import type { MemberTier } from "@/lib/billing/member-badge";
import type { PlanCode } from "@/lib/billing/catalog";
import type { CapabilityKey } from "@/lib/billing/capabilities";
import type { BlockKind, ModeAppearance, ModeSlug, ProfileBlock, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";
import type { AppearanceId } from "@/components/profile/appearance";
import type { LinkProvider } from "@/lib/links/providers";
import type { RewardCategory } from "@/lib/passport/rewards";
import type { ConnectPolicy } from "@/lib/connections/access";

export type Section = "home" | "profile" | "links" | "appearance" | "settings" | "share";
export type PreviewState = "visitor" | "connected";
export type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";
export type EditableProfile = Pick<ProfileIdentity, "username" | "display_name" | "bio">;

export const SECTIONS: { id: Exclude<Section, "home">; title: string; short: string }[] = [
  { id: "profile", title: "Profile", short: "Profile" },
  { id: "links", title: "Content", short: "Content" },
  { id: "appearance", title: "Appearance", short: "Appearance" },
  { id: "settings", title: "Mode Settings", short: "Settings" },
  { id: "share", title: "Share", short: "Share" },
];

export const MODE_SLUGS: ModeSlug[] = ["personal", "event", "business", "creator"];

/** Keys each Mode may store. Mirrors the profile_modes settings check constraint. */
export const SETTING_KEYS: Record<ModeSlug, Record<string, number>> = {
  personal: { note: 280, location: 80, pronouns: 40 },
  event: { eventName: 100, city: 80, dateLabel: 80, role: 80, hereToMeet: 280 },
  business: { role: 80, company: 100, city: 80, description: 280 },
  creator: { tagline: 280, category: 80, city: 80 },
};

/** Why the Plus sheet opened. "appearance" carries the Appearance being applied to this Mode. */
export type PlusTrigger = { kind: "appearance" | "advanced" | "soundtrack" | "qr" | "type" | "restore"; name?: string; appearance?: AppearanceId };

export type EditorApi = {
  /** Actions show to visitors on this site (CREATOR_ACTIONS_ENABLED). */
  actionsLive: boolean;
  profile: ProfileIdentity;
  modes: ProfileMode[];
  mode: ProfileMode;
  slug: ModeSlug;
  section: Section;
  publicOrigin: string;
  fieldErrors: Record<string, string>;
  usernameStatus: UsernameStatus;
  unlockedRewards: string[];
  selectedRewards: Partial<Record<RewardCategory, string>>;
  busyPhoto: boolean;
  /** Server-resolved member status, so the owner preview matches the public profile. */
  memberTier: MemberTier | null;
  plan: PlanCode;
  updateProfile: (patch: Partial<EditableProfile>) => void;
  updateSetting: (key: string, value: string) => void;
  updateAppearance: (patch: Partial<ModeAppearance>) => void;
  /** The unsaved premium look the owner is previewing for this Mode, or null. */
  appearancePreview: ModeAppearance | null;
  /** Saves a choice, or previews it when it needs Plus (never published). */
  chooseAppearance: (patch: Partial<ModeAppearance>) => void;
  clearAppearancePreview: () => void;
  /** Saves the preview when the plan allows it, otherwise opens the Plus sheet. */
  applyAppearancePreview: () => void;
  /** Resets this Mode's visual config to its Free default; nothing else changes. */
  resetAppearance: () => void;
  openPlusSheet: (trigger: PlusTrigger) => void;
  requestCapability: (capability: CapabilityKey) => void;
  setModeEnabled: (enabled: boolean) => Promise<void>;
  setConnectPolicy: (policy: ConnectPolicy) => Promise<void>;
  /** Share intent requested by the URL (?intent=in_person), read once by Share. */
  initialShareIntent: "profile" | "in_person";
  setPublished: (published: boolean) => Promise<void>;
  addLink: (provider: LinkProvider, title: string, value: string) => Promise<string | null>;
  editLink: (link: ProfileLink, title: string, value: string) => Promise<string | null>;
  toggleLink: (link: ProfileLink) => void;
  deleteLink: (link: ProfileLink) => void;
  reorderLinks: (ordered: ProfileLink[]) => void;
  copyLinksFrom: (slug: ModeSlug) => Promise<void>;
  addBlock: (kind: BlockKind, data: Record<string, unknown>, options?: { soundtrack?: boolean }) => Promise<string | null>;
  updateBlock: (block: ProfileBlock, data: Record<string, unknown>, options?: { soundtrack?: boolean }) => Promise<string | null>;
  /** Make a music block its Mode's soundtrack (replacing the last one), or remove that role. */
  setSoundtrack: (block: ProfileBlock, on: boolean) => void;
  toggleBlock: (block: ProfileBlock) => void;
  deleteBlock: (block: ProfileBlock) => void;
  reorderBlocks: (ordered: ProfileBlock[]) => void;
  pickPhoto: () => void;
  recropPhoto: () => void;
  removePhoto: () => void;
  usePhotoFrom: (slug: ModeSlug) => void;
  /** Add a slideshow photo (opens the Plus sheet on Free), or remove one by index. */
  pickSlide: () => void;
  removeSlide: (index: number) => void;
  equipReward: (category: RewardCategory, rewardId: string) => Promise<void>;
  go: (section: Section, slug?: ModeSlug) => void;
  toast: (text: string, action?: { label: string; run: () => void }) => void;
  publicUrl: (slug: ModeSlug, source?: string) => string;
  /** Rotates an Event or Business share link. Resolves false if it could not. */
  regenerateShareLink: (slug: ModeSlug) => Promise<boolean>;
  /** The Mode's own link (`/s/<short id>`), which keeps working when a handle is live. */
  shortUrl: (slug: ModeSlug) => string | null;
  modeHandles: Partial<Record<ModeHandleSlug, ModeHandleState>>;
  setModeHandle: (slug: ModeHandleSlug, state: ModeHandleState | null) => void;
};
