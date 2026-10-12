import { legacySource, placePhoto, sourceFocus, PHOTO_ASPECT, type PhotoFocus, type PhotoPlacement, type PhotoSource } from "./photo-focus";

/**
 * Face-safe composition for photo-led heroes. Deterministic and dependency-free: no face
 * detection runs. The saved focus point (image_focus_x/y, marked on the face in the crop dialog)
 * plus a typical head-and-shoulders proportion give a face box; a future detector can pass a real
 * box instead (`faceBox`) and nothing else changes.
 *
 * Strategies, in order: BOTTOM (identity below the chin), TOP (face sits low, open space above),
 * SPLIT (name above the brows, actions below the chin), AUTO SHIFT (reframe the photo upwards
 * within bounds, then fit the name), and shrinking the name only as the last resort.
 */

export type FaceBox = { top: number; mouth: number; chin: number; left: number; right: number };
export type FaceStrategy = "bottom" | "top" | "split";

export type FaceSafeInput = {
  frame: { width: number; height: number };
  /** Null when the Mode has no photo. */
  focus: PhotoFocus | null;
  /** The photo as the hero draws it (kept original + crop). Without it, a saved 4:5 photo of `focus`. */
  source?: Pick<PhotoSource, "aspect" | "crop" | "focus"> | null;
  /** Zoom factor around the face: 1–1.4 closer; 0.7–1 reveals more of the photo (placePhoto). */
  zoom?: number;
  photoAspect?: number;
  /** A detected face in fractions (0–1) of the whole image. Optional; estimated from the focus otherwise. */
  faceBox?: FaceBox | null;
  name: string;
  /** The Appearance's base name size in px at 390 wide, and the chosen scale. */
  nameBase: number;
  nameScale: number;
  /** The name style's average glyph width in em (0.55 when absent) and its line height. */
  nameCharWidth?: number;
  nameLeading?: number;
  namePosition: "auto" | "top" | "bottom";
  liveContext: boolean;
  meta: boolean;
  featuredSound: boolean;
  socialStyle: "rail" | "row" | "compact" | "hidden";
  secondary: boolean;
};

export type FaceSafeLayout = {
  strategy: FaceStrategy;
  /** Final name size in px. */
  nameSize: number;
  /** Photo moved up by this many px to clear the face (AUTO SHIFT). */
  shiftY: number;
  /** Identity aligns right when the face sits on the left. */
  align: "left" | "right";
  /** The face box in frame pixels after zoom and shift, or null without a photo. */
  face: FaceBox | null;
  /** Photo edges in frame pixels after zoom and shift (for the dissolve mask). */
  imageTop: number;
  imageBottom: number;
  decision: string;
};

/** Top of the identity block (below the top controls) and bottom inset, at any frame size. */
export const SAFE_TOP = 66;
export const SAFE_BOTTOM = 34;
const MARGIN = 18;
const MAX_SHIFT = 190;
/** Brow, mouth and chin relative to the marked face point, in photo heights; half width in photo heights. */
const FACE_MODEL = { brow: -0.12, mouth: 0.1, chin: 0.17, halfWidth: 0.15 };

const SOCIAL_HEIGHT = { rail: 54, row: 34, compact: 52, hidden: 0 } as const;

const chars = (text: string) => [...text].length;

/** The name size before any face-safe fitting: the Appearance base, scaled, and fitted to width. */
export function fittedNameSize(name: string, base: number, scale: number, width: number, fitWidth = width - 44, charWidth = 0.55) {
  const longest = Math.max(1, ...name.trim().split(/\s+/).map(chars));
  const size = Math.min(base * scale, fitWidth / (charWidth * longest));
  return Math.round(chars(name.trim()) > 22 ? size * 0.8 : size);
}

type Framed = Pick<PhotoSource, "aspect" | "crop" | "focus">;

/** A source for a bare focus: a saved 4:5 photo (or `photoAspect`) that is its own crop. */
export function focusSource(focus: PhotoFocus, photoAspect = PHOTO_ASPECT): Framed {
  return legacySource("", focus, photoAspect);
}

/**
 * Where the marked face point lands in a frame (frame pixels), the image's placement, and the
 * subject scale: the crop's height in frame pixels, which the face model is measured against.
 */
export function facePoint(source: Framed, frame: { width: number; height: number }, zoom = 1) {
  const placement = placePhoto(source, frame.width / frame.height, zoom);
  const face = sourceFocus(source);
  const imageWidth = placement.width * frame.width;
  const imageHeight = placement.height * frame.height;
  return {
    x: placement.left * frame.width + face.x * imageWidth,
    y: placement.top * frame.height + face.y * imageHeight,
    imageWidth,
    imageHeight,
    subject: source.crop.h * imageHeight,
    placement,
  };
}

/** The face box in frame pixels, as the photo is drawn at `zoom`, then shifted. */
export function estimateFace(source: Framed, frame: { width: number; height: number }, { zoom = 1, shiftY = 0, faceBox = null }: { zoom?: number; shiftY?: number; faceBox?: FaceBox | null } = {}): FaceBox {
  const point = facePoint(source, frame, zoom);
  const { placement } = point;
  const toFrameY = (fraction: number) => placement.top * frame.height + fraction * point.imageHeight + shiftY;
  const toFrameX = (fraction: number) => placement.left * frame.width + fraction * point.imageWidth;
  if (faceBox) return { top: toFrameY(faceBox.top), mouth: toFrameY(faceBox.mouth), chin: toFrameY(faceBox.chin), left: toFrameX(faceBox.left), right: toFrameX(faceBox.right) };
  return {
    top: point.y + FACE_MODEL.brow * point.subject + shiftY,
    mouth: point.y + FACE_MODEL.mouth * point.subject + shiftY,
    chin: point.y + FACE_MODEL.chin * point.subject + shiftY,
    left: point.x - FACE_MODEL.halfWidth * point.subject,
    right: point.x + FACE_MODEL.halfWidth * point.subject,
  };
}

/** The lowest zoom the editor offers. */
export const ZOOM_OUT_MIN = 0.7;

/** Image edges in frame pixels for a placement (for the dissolve mask). */
function imageEdges(placement: PhotoPlacement, height: number, shiftY: number) {
  return { imageTop: placement.top * height + shiftY, imageBottom: (placement.top + placement.height) * height + shiftY };
}

export function solveFaceSafe(input: FaceSafeInput): FaceSafeLayout {
  const { frame } = input;
  const width = frame.width;
  const height = frame.height;
  const zoom = input.zoom ?? 1;
  const name = input.name.trim();
  const words = name.split(/\s+/).filter(Boolean);
  const charWidth = input.nameCharWidth ?? 0.55;
  const leading = Math.max(0.94, input.nameLeading ?? 0.94);
  const base = fittedNameSize(name, input.nameBase, input.nameScale, width, width - 44, charWidth);
  const lines = (size: number) => Math.min(Math.max(1, Math.ceil((chars(name) * size * (charWidth - 0.02)) / (width - 40))), Math.max(words.length, 1), 3);
  const above = (size: number) => (input.liveContext ? 42 : 0) + Math.round(lines(size) * size * leading) + 12 + (input.meta ? 30 : 0);
  const below = (input.featuredSound ? 27 : 0) + SOCIAL_HEIGHT[input.socialStyle] + 68 + (input.secondary && width < 360 ? 62 : 0);
  const total = (size: number) => above(size) + below;
  const bottomLimit = height - SAFE_BOTTOM;

  if (!input.focus) {
    return { strategy: "bottom", nameSize: base, shiftY: 0, align: "left", face: null, imageTop: 0, imageBottom: height, decision: "NO PHOTO · BOTTOM" };
  }

  // Zoomed out, the window grows past the crop: real image from the original first, then the
  // Appearance's atmosphere where even the original runs out.
  const source = input.source ?? focusSource(input.focus, input.photoAspect);
  let shiftY = 0;
  let face = estimateFace(source, frame, { zoom, shiftY, faceBox: input.faceBox });
  const clearTop = () => face.top - MARGIN;
  const clearBottom = () => face.chin + MARGIN;
  const fitAboveBrow = () => {
    let size = base;
    while (SAFE_TOP + above(size) > clearTop() && size > base * 0.8) size -= 2;
    return SAFE_TOP + above(size) <= clearTop() ? size : null;
  };

  let strategy: FaceStrategy = "bottom";
  let nameSize = base;
  let decision = "";

  if (input.namePosition === "top") {
    const size = fitAboveBrow();
    if (size && bottomLimit - below >= clearBottom()) {
      strategy = "split";
      nameSize = size;
      decision = size < base ? "TOP · NAME FITTED ABOVE BROW · ACTIONS BELOW CHIN" : "TOP · NAME ABOVE BROW · ACTIONS BELOW CHIN";
    }
  }

  if (!decision) {
    const roomBelow = bottomLimit - clearBottom();
    const roomAbove = clearTop() - SAFE_TOP;
    if (total(base) <= roomBelow) {
      strategy = "bottom";
      decision = `BOTTOM · CLEARS CHIN BY ${Math.round(roomBelow - total(base) + MARGIN)}PX`;
    } else if (input.namePosition !== "bottom" && total(base) <= roomAbove) {
      strategy = "top";
      decision = "TOP · FACE LOW, OPEN SPACE ABOVE";
    } else if (input.namePosition !== "bottom" && fitAboveBrow() && bottomLimit - below >= clearBottom()) {
      strategy = "split";
      nameSize = fitAboveBrow()!;
      decision = "SPLIT · NAME ABOVE BROW · ACTIONS BELOW CHIN";
    } else {
      // Reframe within bounds before touching the name, then shrink only as far as needed.
      const need = Math.ceil(total(base) - roomBelow);
      shiftY = -Math.min(Math.max(need, 0), MAX_SHIFT);
      face = estimateFace(source, frame, { zoom, shiftY, faceBox: input.faceBox });
      let size = base;
      while (total(size) > bottomLimit - clearBottom() && size > base * 0.78) size -= 2;
      strategy = "bottom";
      nameSize = size;
      decision = `AUTO-SHIFT · PHOTO UP ${-shiftY}PX${size < base ? " · NAME FITTED" : ""}`;
    }
  }

  const centre = (face.left + face.right) / 2;
  const align = centre < width * 0.4 ? "right" : "left";
  if (align === "right") decision += " · ALIGN RIGHT";
  const { imageTop, imageBottom } = imageEdges(placePhoto(source, width / height, zoom), height, shiftY);
  return { strategy, nameSize, shiftY, align, face, imageTop, imageBottom, decision };
}

/** The dissolve mask for an Immersive photo: solid behind the face, fading into its atmosphere. */
export function immersiveMask(layout: Pick<FaceSafeLayout, "imageTop" | "imageBottom">, height: number) {
  const top = Math.max(0, layout.imageTop);
  const bottom = Math.min(height, layout.imageBottom);
  return `linear-gradient(#0000 ${Math.round(Math.max(0, top - 2))}px,#000 ${Math.round(top > 0 ? top + 150 : 0)}px,#000 ${Math.round(bottom - height * 0.24)}px,#0000 ${Math.round(bottom)}px)`;
}

/** The scrim behind the identity for each strategy, and the deeper manual choice. */
export function immersiveScrim(strategy: FaceStrategy, readability: "auto" | "soft" | "deep") {
  if (readability === "deep") return "linear-gradient(180deg,#0D0D0D8C 0%,#0D0D0D00 22%,#0D0D0D33 46%,#0D0D0DD9 82%,#120F0DF2 100%)";
  if (strategy === "top") return "linear-gradient(180deg,#0D0D0DC7 0%,#0D0D0D80 26%,#0D0D0D00 46%,#0D0D0D00 78%,#120F0D00 100%)";
  if (strategy === "split") return "linear-gradient(180deg,#0D0D0DB3 0%,#0D0D0D59 24%,#0D0D0D00 40%,#0D0D0D00 62%,#0D0D0DA6 84%,#120F0D00 100%)";
  return "linear-gradient(180deg,#0D0D0D66 0%,#0D0D0D00 20%,#0D0D0D00 50%,#0D0D0DA6 82%,#120F0D00 100%)";
}
