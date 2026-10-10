"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactEventHandler } from "react";

import { focusPosition, PHOTO_ASPECT, type PhotoFocus } from "./photo-focus";

/**
 * A Mode photo that fills its frame (`object-fit: cover`) and keeps the saved focus point in
 * view. It measures its own frame, so the face stays centred whatever the canvas size; before
 * that (server render) it uses `frameAspect` when the frame is fixed, or the focus itself.
 */
export function FocusedPhoto({ src, alt, focus, frameAspect, className = "", sizes, priority, fetchPriority, onError, style }: {
  src: string;
  alt: string;
  focus: PhotoFocus;
  /** Width / height of the frame when it is fixed, for an exact first paint. */
  frameAspect?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fetchPriority?: "high" | "low" | "auto";
  onError?: ReactEventHandler<HTMLImageElement>;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [measured, setMeasured] = useState<{ frame: number; photo: number } | null>(null);

  useEffect(() => {
    const image = ref.current;
    if (!image) return;
    const measure = () => {
      const frame = image.clientHeight ? image.clientWidth / image.clientHeight : 0;
      const photo = image.naturalHeight ? image.naturalWidth / image.naturalHeight : PHOTO_ASPECT;
      if (frame) setMeasured((current) => current && Math.abs(current.frame - frame) < 0.001 && current.photo === photo ? current : { frame, photo });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(image);
    image.addEventListener("load", measure);
    return () => { observer.disconnect(); image.removeEventListener("load", measure); };
  }, [src]);

  const objectPosition = measured ? focusPosition(focus, measured.frame, measured.photo) : focusPosition(focus, frameAspect);
  return (
    <Image
      alt={alt}
      className={`object-cover ${className}`}
      data-photo-focus={`${focus.x} ${focus.y}`}
      fetchPriority={fetchPriority}
      fill
      onError={onError}
      priority={priority}
      ref={ref}
      sizes={sizes ?? "100vw"}
      src={src}
      style={{ ...style, objectPosition }}
      unoptimized
    />
  );
}
