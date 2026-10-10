"use client";

import { useRef, useState } from "react";

import { uploadContentImage } from "@/lib/blocks/storage";
import { createClient } from "@/lib/supabase/client";

type ContentImageControlProps = {
  profileId: string;
  imagePath: string;
  previewUrl: string;
  label: string;
  onChange: (path: string | null, url: string | null) => void;
  onBusyChange: (busy: boolean) => void;
  onRemove?: () => void;
};

export function ContentImageControl({ profileId, imagePath, previewUrl, label, onChange, onBusyChange, onRemove }: ContentImageControlProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      const supabase = createClient();
      const result = await uploadContentImage(supabase, profileId, file);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onChange(result.path, result.url);
    } catch {
      setError("The image couldn’t be uploaded. Check your connection and try again.");
    } finally {
      setBusy(false);
      onBusyChange(false);
      if (input.current) input.current.value = "";
    }
  }

  const state = busy ? (imagePath ? "Replacing image…" : "Uploading image…") : error ? "Upload failed" : imagePath ? "Image ready" : previewUrl ? "Preview from link" : "No uploaded image";

  return (
    <section aria-label={label} className="grid gap-3 rounded-2xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
      {previewUrl ? (
        <div className="grid min-h-28 max-h-64 place-items-center overflow-hidden rounded-xl bg-[#F5F4EF] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- private Supabase signed image preview */}
          <img alt="" className="block max-h-60 max-w-full object-contain" loading="lazy" src={previewUrl} />
        </div>
      ) : (
        <div className="grid min-h-28 place-items-center rounded-xl bg-[#F5F4EF] text-sm text-black/45">No image selected</div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button className="inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-4 text-sm font-semibold text-[#F5F4EF] disabled:opacity-50" disabled={busy} onClick={() => input.current?.click()} type="button">
          {busy ? state : imagePath ? "Replace image" : "Upload image"}
        </button>
        {imagePath && onRemove && <button className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-black/65 shadow-[inset_0_0_0_1px_rgba(13,13,13,.16)] disabled:opacity-50" disabled={busy} onClick={onRemove} type="button">Remove uploaded image</button>}
        <span aria-live="polite" className="text-[12px] text-black/50">{state}</span>
        {!busy && !error && <span className="text-[12px] text-black/50">JPEG, PNG or WebP · up to 5 MB</span>}
      </div>
      <input accept="image/jpeg,image/png,image/webp" aria-label={`Upload ${label.toLowerCase()}`} className="sr-only" onChange={(event) => void choose(event.currentTarget.files?.[0])} ref={input} type="file" />
      {error && <p className="text-[13px] font-medium text-[#B42318]" role="alert">{error}</p>}
    </section>
  );
}
