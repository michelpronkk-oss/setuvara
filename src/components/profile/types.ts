export type ModeSlug = "personal" | "event" | "business";
export type ViewerState = "owner" | "visitor_unconnected" | "visitor_connected";

export type ConnectionContext = {
  mode?: ModeSlug;
  event?: string | null;
  city?: string | null;
  dateLabel?: string | null;
};

export type ProfileLink = {
  id: string;
  title: string;
  url: string;
  link_type: string;
  is_visible: boolean;
  sort_order: number;
};

export type BlockKind = "video" | "music" | "feature" | "services" | "highlights" | "testimonial" | "image";

export type ProfileBlock = {
  id: string;
  kind: BlockKind;
  data: Record<string, unknown>;
  is_visible: boolean;
  sort_order: number;
  /** This music block is the Mode's profile soundtrack (at most one per Mode). */
  is_soundtrack?: boolean;
};

export type ModeAppearance = {
  theme: "light" | "dark" | "editorial";
  accent: string;
  layout: string;
  imageTreatment: "full-bleed" | "portrait" | "compact";
};

export type ProfileMode = {
  id: string;
  slug: ModeSlug;
  label: string;
  is_enabled: boolean;
  settings: Record<string, string | boolean>;
  appearance: ModeAppearance;
  image_path: string | null;
  image_url?: string | null;
  links: ProfileLink[];
  /** Content blocks, in order. Absent where a surface doesn't load them. */
  blocks?: ProfileBlock[];
};

export type ProfileIdentity = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  is_published: boolean;
};
