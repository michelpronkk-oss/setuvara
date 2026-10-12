"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Cropper, { type Area, type Size } from "react-easy-crop";

import { DEFAULT_FOCUS, PHOTO_ASPECT, visibleWindow, type PhotoFocus, type PhotoSource } from "@/components/profile/photo-focus";

const ASPECT = PHOTO_ASPECT;
const MAX_WIDTH = 1200;
/** Kept originals are capped to this long edge and re-encoded (which also drops camera metadata). */
const ORIGINAL_MAX_EDGE = 2560;
const ORIGINAL_MAX_BYTES = 4.8 * 1024 * 1024;

/** What the dialog saves: the crop in source pixels and in fractions, the source's size, and the face. */
export type CropResult = { pixels: Area; crop: { x: number; y: number; w: number; h: number }; natural: { width: number; height: number }; focus: PhotoFocus };

export function CropDialog({ source, busy, initialFocus, initialCrop, savedOnly = false, preview, onCancel, onReplace, onSave }: {
  source: string;
  busy: boolean;
  initialFocus?: PhotoFocus;
  /** The saved crop on this source, in fractions, so re-cropping starts where the member left it. */
  initialCrop?: { x: number; y: number; w: number; h: number } | null;
  /** The source is a photo saved before originals were kept: nothing beyond it can be recovered. */
  savedOnly?: boolean;
  /** The real public output for the pending crop (phone and wide profile). */
  preview?: (pending: PhotoSource) => ReactNode;
  onCancel: () => void;
  onReplace: () => void;
  onSave: (result: CropResult) => void | Promise<void>;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [percent, setPercent] = useState<Area | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [cropSize, setCropSize] = useState<Size | null>(null);
  const [step, setStep] = useState<"frame" | "focus">("frame");
  const [focus, setFocus] = useState<PhotoFocus>(initialFocus ?? DEFAULT_FOCUS);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  useEffect(() => { cancelRef.current = onCancel; });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") cancelRef.current(); };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, []);

  const save = () => {
    if (!pixels || !percent || !natural || busy) return;
    const unit = (value: number) => Math.min(1, Math.max(0, value / 100));
    const x = unit(percent.x);
    const y = unit(percent.y);
    void onSave({ pixels, crop: { x, y, w: Math.min(unit(percent.width), 1 - x), h: Math.min(unit(percent.height), 1 - y) }, natural, focus });
  };
  const pending: PhotoSource | null = percent && natural
    ? { url: source, aspect: natural.width / natural.height, crop: { x: percent.x / 100, y: percent.y / 100, w: percent.width / 100, h: percent.height / 100 }, focus, original: !savedOnly }
    : null;

  // Focus is a point in the saved (cropped) photo; the overlay sits exactly over the crop window.
  const placeFocus = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100)));
    setFocus({ x, y });
  };
  const nudgeFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setFocus((current) => ({ x: Math.min(100, Math.max(0, current.x + move[0])), y: Math.min(100, Math.max(0, current.y + move[1])) }));
  };

  return (
    <div aria-label="Crop photo" aria-modal="true" className="fixed inset-0 z-[95] flex bg-[#0D0D0D] text-[#F5F4EF] outline-none sm:items-center sm:justify-center sm:bg-[#0D0D0D]/60 sm:p-6 sm:backdrop-blur-sm" ref={dialogRef} role="dialog" tabIndex={-1}>
      <div className="flex w-full flex-col sm:max-w-[960px] sm:flex-row sm:gap-7 sm:rounded-[28px] sm:bg-[#F5F4EF] sm:p-7 sm:text-[#0D0D0D] sm:shadow-[0_40px_120px_-30px_rgba(0,0,0,.6)]">
        {/* Mobile header */}
        <div className="flex h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)] sm:hidden">
          <button className="min-h-11 px-1 text-[15px] font-semibold" onClick={onCancel} type="button">Cancel</button>
          <p className="font-display text-lg font-bold tracking-[-0.03em]">Crop photo</p>
          <button className="min-h-11 px-1 text-[15px] font-semibold text-[#FF5A4F] disabled:opacity-40" disabled={!pixels || !natural || busy} onClick={save} type="button">{busy ? "Saving…" : "Save"}</button>
        </div>

        <div className="relative mx-4 min-h-0 flex-1 overflow-hidden rounded-[22px] bg-[#1A1A1A] sm:mx-0 sm:h-[540px] sm:flex-none sm:basis-[440px]" data-crop-step={step}>
          <Cropper
            aspect={ASPECT}
            classes={{ cropAreaClassName: "!border-2 !border-[#F5F4EF] !shadow-[0_0_0_9999px_rgba(13,13,13,.62)]" }}
            crop={crop}
            image={source}
            initialCroppedAreaPercentages={initialCrop ? { x: initialCrop.x * 100, y: initialCrop.y * 100, width: initialCrop.w * 100, height: initialCrop.h * 100 } : undefined}
            maxZoom={4}
            onMediaLoaded={(media) => setNatural({ width: media.naturalWidth, height: media.naturalHeight })}
            onCropChange={setCrop}
            onCropComplete={(area, areaPixels) => { setPercent(area); setPixels(areaPixels); }}
            onCropSizeChange={setCropSize}
            onZoomChange={setZoom}
            showGrid={step === "frame"}
            zoom={zoom}
            zoomSpeed={0.4}
          />
          {cropSize && (
            <div
              aria-label="Face position. Tap the face, or use the arrow keys."
              aria-valuetext={`${focus.x}% across, ${focus.y}% down`}
              className={`absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 touch-none outline-none ${step === "focus" ? "cursor-crosshair" : "pointer-events-none"}`}
              data-testid="crop-focus-area"
              onKeyDown={step === "focus" ? nudgeFocus : undefined}
              onPointerDown={step === "focus" ? (event) => { event.currentTarget.setPointerCapture(event.pointerId); placeFocus(event); } : undefined}
              onPointerMove={step === "focus" ? (event) => { if (event.buttons) placeFocus(event); } : undefined}
              role={step === "focus" ? "slider" : undefined}
              style={{ width: cropSize.width, height: cropSize.height }}
              tabIndex={step === "focus" ? 0 : -1}
            >
              <span
                aria-hidden="true"
                className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition-[width,height,opacity] ${step === "focus" ? "size-16 opacity-100 shadow-[0_0_0_2px_#F5F4EF,0_0_0_9999px_rgba(13,13,13,.18),0_6px_20px_rgba(0,0,0,.45)]" : "size-7 opacity-80 shadow-[0_0_0_2px_#F5F4EF,0_2px_8px_rgba(0,0,0,.4)]"}`}
                style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
              >
                <span className="size-2 rounded-full bg-[#FF5A4F] shadow-[0_0_0_2px_#F5F4EF]" />
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:flex-1 sm:p-0">
          <div className="hidden sm:block">
            <h2 className="font-display text-[2.2rem] font-extrabold leading-none tracking-[-0.05em]">Crop photo</h2>
            <p className="mt-2 text-[15px] text-black/60">Frame your photo, then mark your face. Your full photo is kept, so every layout and zoom can show more of it.</p>
          </div>
          {savedOnly && <p className="mt-3 rounded-[14px] bg-white/10 px-3.5 py-2.5 text-[13px] leading-[18px] sm:mt-4 sm:bg-black/[0.05]" data-crop-saved-only>This photo was saved before Setuvara kept full photos, so only this crop exists. Zoom out can’t show more than it. Choose the photo again to use all of it.</p>}

          <div aria-label="Crop step" className="grid grid-cols-2 gap-1 rounded-full bg-white/10 p-1 sm:mt-6 sm:bg-black/[0.06]" role="tablist">
            {([["frame", "1  Frame"], ["focus", "2  Your face"]] as const).map(([id, label]) => (
              <button aria-selected={step === id} className={`min-h-10 whitespace-pre rounded-full text-sm font-semibold transition ${step === id ? "bg-[#F5F4EF] text-[#0D0D0D] sm:bg-[#0D0D0D] sm:text-[#F5F4EF]" : "opacity-70"}`} key={id} onClick={() => setStep(id)} role="tab" type="button">{label}</button>
            ))}
          </div>

          {step === "frame" ? (
            <div className="mt-4 sm:mt-5">
              <div className="flex items-center justify-between text-sm font-semibold"><label htmlFor="crop-zoom">Zoom</label><span className="font-label text-xs opacity-60">{zoom.toFixed(1)}×</span></div>
              <div className="mt-1 flex items-center gap-3">
                <button aria-label="Zoom out" className="grid size-10 place-items-center rounded-full text-lg hover:bg-white/10 sm:hover:bg-black/5" onClick={() => setZoom((value) => Math.max(1, value - 0.2))} type="button">−</button>
                <input className="h-1 flex-1 cursor-pointer accent-[#FF5A4F]" id="crop-zoom" max={4} min={1} onChange={(event) => setZoom(Number(event.target.value))} step={0.01} type="range" value={zoom} />
                <button aria-label="Zoom in" className="grid size-10 place-items-center rounded-full text-lg hover:bg-white/10 sm:hover:bg-black/5" onClick={() => setZoom((value) => Math.min(4, value + 0.2))} type="button">+</button>
              </div>
            </div>
          ) : (
            <p className="mt-4 min-h-[52px] text-sm leading-5 opacity-75 sm:mt-5">Tap your face in the photo. Wide and round layouts centre on it, so it never gets cut off.</p>
          )}

          <div className="mt-4 sm:mt-6">
            <p className="text-sm font-semibold">How it shows</p>
            <div className="mt-2.5 flex items-end gap-3 sm:gap-4" data-crop-previews>
              {preview && pending ? preview(pending) : null}
              <figure className="text-center">
                {/* Avatars (lists, the app bar) draw the saved crop around the face, exactly like this. */}
                <div className="size-14 rounded-full bg-[#1A1A1A] bg-no-repeat sm:size-[72px]" data-frame="avatar" style={framePreview(source, percent, focus, 1)} />
                <figcaption className="mt-1.5 text-[11px] opacity-70">Avatar</figcaption>
              </figure>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button className="inline-flex min-h-11 items-center rounded-full px-[18px] text-sm font-semibold shadow-[inset_0_0_0_1.5px_currentColor]" onClick={onReplace} type="button">Choose another</button>
          </div>

          <div className="mt-auto hidden items-center justify-end gap-3 pt-8 sm:flex">
            <button className="min-h-12 rounded-full px-5 text-[15px] font-semibold hover:bg-black/5" onClick={onCancel} type="button">Cancel</button>
            <button className="min-h-12 rounded-full bg-[#0D0D0D] px-7 text-[15px] font-semibold text-[#F5F4EF] disabled:opacity-40" disabled={!pixels || !natural || busy} onClick={save} type="button">{busy ? "Saving…" : "Save photo"}</button>
          </div>
          <p className="mt-4 text-center text-xs opacity-55 sm:hidden">{step === "frame" ? "Drag to reposition · pinch to zoom" : "Tap or drag to mark your face"}</p>
        </div>
      </div>
    </div>
  );
}

/** Background styles showing exactly what a cover frame of `frameAspect` shows of the crop. */
function framePreview(source: string, area: Area | null, focus: PhotoFocus, frameAspect: number) {
  if (!area) return { backgroundImage: `url("${source}")`, backgroundSize: "cover", backgroundPosition: "center" };
  const view = visibleWindow(focus, frameAspect);
  return previewStyle(source, {
    x: area.x + view.x * area.width,
    y: area.y + view.y * area.height,
    width: view.width * area.width,
    height: view.height * area.height,
  });
}

function previewStyle(source: string, area: Area) {
  const scale = 100 / Math.max(area.width, 0.01);
  const x = area.width >= 100 ? 0 : (area.x / (100 - area.width)) * 100;
  const y = area.height >= 100 ? 0 : (area.y / (100 - area.height)) * 100;
  return { backgroundImage: `url("${source}")`, backgroundSize: `${scale * 100}% auto`, backgroundPosition: `${x}% ${y}%` };
}

export async function cropToBlob(source: string, area: Area): Promise<Blob> {
  const image = new window.Image();
  image.crossOrigin = "anonymous";
  image.src = source;
  await image.decode();
  const width = Math.min(MAX_WIDTH, Math.round(area.width));
  const height = Math.round(width / ASPECT);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Encoding failed")), "image/webp", 0.88));
}

/**
 * The original upload, kept beside the crop: the whole frame, capped to ORIGINAL_MAX_EDGE and
 * re-encoded as WebP (so camera metadata such as location never reaches Storage).
 */
export async function originalToBlob(source: string): Promise<{ blob: Blob; width: number; height: number }> {
  const image = new window.Image();
  image.crossOrigin = "anonymous";
  image.src = source;
  await image.decode();
  const scale = Math.min(1, ORIGINAL_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  for (const quality of [0.9, 0.8, 0.7]) {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Encoding failed")), "image/webp", quality));
    if (blob.size <= ORIGINAL_MAX_BYTES || quality === 0.7) return { blob, width, height };
  }
  throw new Error("Encoding failed");
}
