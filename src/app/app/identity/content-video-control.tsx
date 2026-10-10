"use client";

import { useEffect, useRef, useState } from "react";

import { CONTENT_VIDEO_MAX_BYTES, uploadContentVideo } from "@/lib/blocks/storage";
import { createClient } from "@/lib/supabase/client";

type ContentVideoControlProps = {
  videoPath: string;
  previewUrl: string;
  mimeType: string;
  label: string;
  onChange: (path: string, url: string, mimeType: "video/mp4" | "video/webm") => void;
  onBusyChange: (busy: boolean) => void;
  onPlayableChange: (playable: boolean) => void;
  profileId: string;
};

export function ContentVideoControl({ videoPath, previewUrl, mimeType, label, onChange, onBusyChange, onPlayableChange, profileId }: ContentVideoControlProps) {
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const localPreview = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const source = localPreviewUrl ?? previewUrl;

  useEffect(() => () => {
    if (localPreview.current) URL.revokeObjectURL(localPreview.current);
  }, []);

  useEffect(() => {
    if (source) video.current?.load();
  }, [source]);

  async function choose(file: File | undefined) {
    if (!file || busy) return;
    if (localPreview.current) URL.revokeObjectURL(localPreview.current);
    localPreview.current = URL.createObjectURL(file);
    setLocalPreviewUrl(localPreview.current);
    setBusy(true);
    onBusyChange(true);
    onPlayableChange(false);
    setProgress(0);
    setError(null);
    setPreviewError(false);

    try {
      const result = await uploadContentVideo(createClient(), profileId, file, setProgress);
      if ("error" in result) {
        URL.revokeObjectURL(localPreview.current);
        localPreview.current = null;
        setLocalPreviewUrl(null);
        setError(result.error);
        return;
      }
      onChange(result.path, result.url, result.mimeType);
      URL.revokeObjectURL(localPreview.current);
      localPreview.current = null;
      setLocalPreviewUrl(null);
    } catch {
      if (localPreview.current) URL.revokeObjectURL(localPreview.current);
      localPreview.current = null;
      setLocalPreviewUrl(null);
      setError("The video couldn’t be uploaded. Check your connection and try again.");
    } finally {
      setBusy(false);
      onBusyChange(false);
      if (input.current) input.current.value = "";
    }
  }

  const state = busy ? `Uploading video · ${progress}%` : error ? "Upload failed" : videoPath ? "Video ready" : "Choose a video";

  return (
    <section aria-label={label} className="grid gap-3 rounded-2xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
      {source ? (
        <div className="overflow-hidden rounded-xl bg-[#0D0D0D]">
          <video
            aria-label={label}
            className="block max-h-[min(52vh,420px)] w-full object-contain"
            controls
            playsInline
            preload="metadata"
            onCanPlay={() => { setPreviewError(false); onPlayableChange(true); }}
            onError={() => { setPreviewError(true); onPlayableChange(false); }}
            ref={video}
          >
            <source src={source} type={localPreviewUrl ? undefined : mimeType || undefined} />
          </video>
        </div>
      ) : (
        <div className="grid min-h-28 place-items-center rounded-xl bg-[#F5F4EF] text-sm text-black/45">No video selected</div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button className="inline-flex min-h-11 items-center rounded-full bg-[#0D0D0D] px-4 text-sm font-semibold text-[#F5F4EF] disabled:opacity-50" disabled={busy} onClick={() => input.current?.click()} type="button">
          {busy ? state : videoPath ? "Replace video" : "Choose video"}
        </button>
        <span aria-live="polite" className="text-[12px] text-black/50">{state}</span>
        {!busy && !error && <span className="text-[12px] text-black/50">MP4 or WebM · up to {CONTENT_VIDEO_MAX_BYTES / 1024 / 1024} MB</span>}
      </div>
      {error && <p className="text-[13px] font-medium text-[#B42318]" role="alert">{error}</p>}
      {previewError && <p className="text-[13px] font-medium text-[#B42318]" role="alert">This video can’t play in this browser. Choose a browser-compatible MP4 or WebM.</p>}
      <input accept="video/mp4,video/webm,.mp4,.webm" aria-label={`Choose ${label.toLowerCase()}`} className="sr-only" onChange={(event) => void choose(event.currentTarget.files?.[0])} ref={input} type="file" />
    </section>
  );
}
