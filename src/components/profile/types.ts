export type ModeSlug = "personal" | "event" | "business" | "creator";
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

export type AppearanceId = "immersive" | "motion" | "aura" | "clean" | "glow" | "scene" | "frame" | "stack" | "social" | "film";
/** Themes saved before the ten Appearances. Still readable; the resolver maps them to an Appearance. */
export type LegacyThemeId = "light" | "dark" | "editorial" | "noir" | "signal" | "studio";

/**
 * A Mode's saved appearance (profile_modes.appearance). Every value is an enumerated id or a
 * bounded number, never CSS. New saves write an Appearance id as `theme`; rows saved earlier may
 * still carry a legacy theme and the legacy layout keys, which stay valid and are normalized by
 * resolveAppearance().
 */
export type ModeAppearance = {
  theme: AppearanceId | LegacyThemeId;
  accent: string;
  /** Legacy composition keys (retired from the editor, still accepted and read). */
  layout?: string;
  imageTreatment?: "full-bleed" | "portrait" | "compact" | "frame";
  /** Frame around the QR code; the code itself never changes. Paid frames fall back on Free. */
  qrStyle?: "standard" | "accent-frame" | "label" | "inverse" | "rounded";
  /** Legacy Plus refinements (retired from the editor, kept so nothing saved is lost). */
  intensity?: "quiet" | "balanced" | "signal";
  card?: "flat" | "outline" | "soft" | "layered" | "editorial";
  radius?: "sharp" | "subtle" | "soft";
  button?: "pill" | "block" | "editorial" | "minimal";
  links?: "icons" | "list" | "chips" | "cards";
  /** Legacy soundtrack presentation; soundtrackPresentation wins when both exist. */
  soundStyle?: "core" | "strip" | "disc" | "poster";
  /** Photo zoom in percent. 110 and 120 are kept as legacy values. Photo focus stays in image_focus_x/y. */
  portraitZoom?: 70 | 85 | 100 | 110 | 115 | 120 | 130 | 140;
  portraitNameSize?: "compact" | "standard" | "large" | "statement";
  portraitShowUsername?: boolean;
  /** Where the name sits on photo-led Appearances. Auto is face-safe; "center" is never stored. */
  namePosition?: "auto" | "top" | "bottom";
  /** Scrim strength over the photo. Auto is face- and contrast-aware. */
  readability?: "auto" | "soft" | "deep";
  socialStyle?: "rail" | "row" | "compact" | "hidden";
  /** Where platforms show. Absent: In links when socialStyle is hidden, else Under name. "both" repeats them on purpose. */
  socialPlacement?: "name" | "links" | "both";
  /** Name, details, icons and buttons: the look's own alignment (absent/auto), left or centered. */
  identityAlign?: "auto" | "left" | "center";
  /** Photo slideshow pace (Plus and Pro). */
  slideSpeed?: "slow" | "medium" | "fast";
  /** How a run of pictures shows under the Appearance. Absent: featured. */
  mediaLayout?: "featured" | "stack" | "grid" | "carousel";
  /** Display style of the name (name-type.ts). Absent: Setuvara, the Appearance's own. */
  nameFont?: "setuvara" | "modern" | "editorial" | "condensed" | "impact" | "soft";
  motion?: "off" | "subtle" | "full";
  soundtrackPresentation?: "ambient" | "minimal" | "featured";
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
  /**
   * The kept original upload (size-capped) and the member's crop on it, as fractions plus the
   * original's pixel size. Null for photos saved before originals were kept: those render from
   * image_path alone. See photo-focus `photoSource`.
   */
  image_original_path?: string | null;
  image_original_url?: string | null;
  image_crop?: PhotoCropValue | null;
  /** Focus point inside the saved photo, 0–100. Null means the default (see photo-focus). */
  image_focus_x?: number | null;
  image_focus_y?: number | null;
  /** Extra slideshow photos after the main photo (stored), and their signed URLs (loaded). */
  slide_photos?: SlidePhoto[];
  slide_urls?: SlideImage[];
  /** Who can start a new inbound Connection from this Mode. Absent means anyone. */
  connect_policy?: "anyone" | "direct_only" | "nobody";
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

/** A published profile's currently effective Live Context, as the public RPC returns it. */
export type PublicLiveContext = {
  label: string;
  type: "event" | "meeting" | "place" | "custom";
  expiresAt: string;
};

/** One stored slideshow photo: owner-scoped object path and its face point (0–100). */
/** Stored crop metadata on a kept original (see photo-focus `readCrop`). */
export type PhotoCropValue = { x: number; y: number; w: number; h: number; width: number; height: number };

export type SlidePhoto = { path: string; x: number; y: number };
/** A slideshow photo ready to render. */
export type SlideImage = { url: string; x: number; y: number };
