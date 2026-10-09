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
};

export type ProfileIdentity = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  is_published: boolean;
};
