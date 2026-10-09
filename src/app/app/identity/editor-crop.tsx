"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { cutCorner } from "./editor-ui";

const ASPECT = 4 / 5;
const MAX_WIDTH = 1200;

export function CropDialog({ source, busy, onCancel, onReplace, onSave }: { source: string; busy: boolean; onCancel: () => void; onReplace: () => void; onSave: (area: Area) => void | Promise<void> }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [percent, setPercent] = useState<Area | null>(null);
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

  const save = () => { if (pixels && !busy) void onSave(pixels); };
  const preview = percent ? previewStyle(source, percent) : { backgroundImage: `url("${source}")`, backgroundSize: "cover", backgroundPosition: "center" };

  return (
    <div aria-label="Crop photo" aria-modal="true" className="fixed inset-0 z-[95] flex bg-[#0D0D0D] text-[#F5F4EF] outline-none sm:items-center sm:justify-center sm:bg-[#0D0D0D]/60 sm:p-6 sm:backdrop-blur-sm" ref={dialogRef} role="dialog" tabIndex={-1}>
      <div className="flex w-full flex-col sm:max-w-[920px] sm:flex-row sm:gap-7 sm:rounded-[28px] sm:bg-[#F5F4EF] sm:p-7 sm:text-[#0D0D0D] sm:shadow-[0_40px_120px_-30px_rgba(0,0,0,.6)]">
        {/* Mobile header */}
        <div className="flex h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)] sm:hidden">
          <button className="min-h-11 px-1 text-[15px] font-semibold" onClick={onCancel} type="button">Cancel</button>
          <p className="font-display text-lg font-bold tracking-[-0.03em]">Crop photo</p>
          <button className="min-h-11 px-1 text-[15px] font-semibold text-[#FF5A4F] disabled:opacity-40" disabled={!pixels || busy} onClick={save} type="button">{busy ? "Saving…" : "Save"}</button>
        </div>

        <div className="relative mx-4 min-h-0 flex-1 overflow-hidden rounded-[22px] bg-[#1A1A1A] sm:mx-0 sm:h-[520px] sm:flex-none sm:basis-[440px]">
          <Cropper
            aspect={ASPECT}
            classes={{ cropAreaClassName: "!border-2 !border-[#F5F4EF] !shadow-[0_0_0_9999px_rgba(13,13,13,.62)]" }}
            crop={crop}
            image={source}
            maxZoom={4}
            onCropChange={setCrop}
            onCropComplete={(area, areaPixels) => { setPercent(area); setPixels(areaPixels); }}
            onZoomChange={setZoom}
            showGrid
            zoom={zoom}
            zoomSpeed={0.4}
          />
        </div>

        <div className="flex flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:flex-1 sm:p-0">
          <div className="hidden sm:block">
            <h2 className="font-display text-[2.2rem] font-extrabold leading-none tracking-[-0.05em]">Crop photo</h2>
            <p className="mt-2 text-[15px] text-black/60">Drag to reposition. The 60° corner is applied for you.</p>
          </div>

          <div className="sm:mt-7">
            <div className="flex items-center justify-between text-sm font-semibold"><label htmlFor="crop-zoom">Zoom</label><span className="font-label text-xs opacity-60">{zoom.toFixed(1)}×</span></div>
            <div className="mt-2 flex items-center gap-3">
              <button aria-label="Zoom out" className="grid size-10 place-items-center rounded-full text-lg hover:bg-white/10 sm:hover:bg-black/5" onClick={() => setZoom((value) => Math.max(1, value - 0.2))} type="button">−</button>
              <input className="h-1 flex-1 cursor-pointer accent-[#FF5A4F]" id="crop-zoom" max={4} min={1} onChange={(event) => setZoom(Number(event.target.value))} step={0.01} type="range" value={zoom} />
              <button aria-label="Zoom in" className="grid size-10 place-items-center rounded-full text-lg hover:bg-white/10 sm:hover:bg-black/5" onClick={() => setZoom((value) => Math.min(4, value + 0.2))} type="button">+</button>
            </div>
          </div>

          <div className="mt-5 sm:mt-7">
            <p className="text-sm font-semibold">Preview</p>
            <div className="mt-3 flex items-end gap-5">
              <figure className="text-center"><div className="h-[110px] w-[88px] bg-[#1A1A1A] bg-no-repeat" style={{ ...preview, clipPath: cutCorner(26), borderRadius: 14 }} /><figcaption className="mt-2 text-xs opacity-70">Profile</figcaption></figure>
              <figure className="text-center"><div className="size-[64px] rounded-full bg-[#1A1A1A] bg-no-repeat" style={preview} /><figcaption className="mt-2 text-xs opacity-70">Avatar</figcaption></figure>
              <figure className="text-center"><div className="relative h-[90px] w-[64px] overflow-hidden rounded-[10px] bg-[#0D0D0D] p-1.5"><div className="h-[52px] w-full rounded-md bg-no-repeat" style={preview} /><div className="mt-1.5 h-1 w-8 rounded bg-white/70" /><div className="mt-1 h-1 w-5 rounded bg-white/35" /></div><figcaption className="mt-2 text-xs opacity-70">Card</figcaption></figure>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <button className="inline-flex min-h-11 items-center rounded-full px-[18px] text-sm font-semibold shadow-[inset_0_0_0_1.5px_currentColor]" onClick={onReplace} type="button">Choose another</button>
          </div>

          <div className="mt-auto hidden items-center justify-end gap-3 pt-8 sm:flex">
            <button className="min-h-12 rounded-full px-5 text-[15px] font-semibold hover:bg-black/5" onClick={onCancel} type="button">Cancel</button>
            <button className="min-h-12 rounded-full bg-[#0D0D0D] px-7 text-[15px] font-semibold text-[#F5F4EF] disabled:opacity-40" disabled={!pixels || busy} onClick={save} type="button">{busy ? "Saving…" : "Save photo"}</button>
          </div>
          <p className="mt-5 text-center text-xs opacity-55 sm:hidden">Drag to reposition · pinch to zoom</p>
        </div>
      </div>
    </div>
  );
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
