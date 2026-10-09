import type { BlockKind, ModeAppearance, ModeSlug, ProfileBlock, ProfileIdentity, ProfileLink, ProfileMode } from "@/components/profile/types";
import type { LinkProvider } from "@/lib/links/providers";
import type { RewardCategory } from "@/lib/passport/rewards";

export type Section = "home" | "profile" | "links" | "appearance" | "settings" | "share";
export type PreviewState = "owner" | "visitor" | "connected";
export type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";
export type EditableProfile = Pick<ProfileIdentity, "username" | "display_name" | "bio">;

export const SECTIONS: { id: Exclude<Section, "home">; title: string; short: string }[] = [
  { id: "profile", title: "Profile", short: "Profile" },
  { id: "links", title: "Content", short: "Content" },
  { id: "appearance", title: "Appearance", short: "Style" },
  { id: "settings", title: "Mode Settings", short: "Settings" },
  { id: "share", title: "Share", short: "Share" },
];

export const MODE_SLUGS: ModeSlug[] = ["personal", "event", "business"];

/** Keys each Mode may store. Mirrors the profile_modes settings check constraint. */
export const SETTING_KEYS: Record<ModeSlug, Record<string, number>> = {
  personal: { note: 280, location: 80, pronouns: 40 },
  event: { eventName: 100, city: 80, dateLabel: 80, role: 80, hereToMeet: 280 },
  business: { role: 80, company: 100, city: 80, description: 280 },
};

export const LAYOUTS: Record<ModeSlug, { value: string; label: string; note: string }[]> = {
  personal: [{ value: "full-bleed", label: "Full Bleed", note: "Edge-to-edge photo, round icons" }, { value: "portrait-editorial", label: "Portrait Editorial", note: "Framed portrait, quieter" }],
  event: [{ value: "event-poster", label: "Event Poster", note: "Big event header" }, { value: "conference-card", label: "Conference Card", note: "Compact badge header" }],
  business: [{ value: "structured", label: "Structured", note: "Role, company, city table" }, { value: "editorial-business", label: "Editorial Business", note: "Name-first, open layout" }],
};

export type EditorApi = {
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
  updateProfile: (patch: Partial<EditableProfile>) => void;
  updateSetting: (key: string, value: string) => void;
  updateAppearance: (patch: Partial<ModeAppearance>) => void;
  setModeEnabled: (enabled: boolean) => Promise<void>;
  setPublished: (published: boolean) => Promise<void>;
  addLink: (provider: LinkProvider, title: string, value: string) => Promise<string | null>;
  editLink: (link: ProfileLink, title: string, value: string) => Promise<string | null>;
  toggleLink: (link: ProfileLink) => void;
  deleteLink: (link: ProfileLink) => void;
  reorderLinks: (ordered: ProfileLink[]) => void;
  copyLinksFrom: (slug: ModeSlug) => Promise<void>;
  addBlock: (kind: BlockKind, data: Record<string, unknown>) => Promise<string | null>;
  updateBlock: (block: ProfileBlock, data: Record<string, unknown>) => Promise<string | null>;
  toggleBlock: (block: ProfileBlock) => void;
  deleteBlock: (block: ProfileBlock) => void;
  reorderBlocks: (ordered: ProfileBlock[]) => void;
  pickPhoto: () => void;
  recropPhoto: () => void;
  removePhoto: () => void;
  usePhotoFrom: (slug: ModeSlug) => void;
  equipReward: (category: RewardCategory, rewardId: string) => Promise<void>;
  go: (section: Section, slug?: ModeSlug) => void;
  toast: (text: string, action?: { label: string; run: () => void }) => void;
  publicUrl: (slug: ModeSlug, source?: string) => string;
};
