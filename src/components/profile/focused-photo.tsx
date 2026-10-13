"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactEventHandler } from "react";

import { ProfileImage } from "./profile-image";
import { focusPosition, placePhoto, PHOTO_ASPECT, type PhotoFocus, type PhotoPlacement, type PhotoSource } from "./photo-focus";

/**
 * A Mode photo that fills its frame (`object-fit: cover`) and keeps the saved focus point in
 * view. It measures its own frame, so the face stays centred whatever the canvas size; before
 * that (server render) it uses `frameAspect` when the frame is fixed, or the focus itself.
 */
export function FocusedPhoto({ src, alt, focus, frameAspect, className = "", sizes, priority, preloadMedia, fetchPriority, onError, style }: {
  src: string;
  alt: string;
  focus: PhotoFocus;
  /** Width / height of the frame when it is fixed, for an exact first paint. */
  frameAspect?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  preloadMedia?: string;
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
    <ProfileImage
      alt={alt}
      className={`object-cover ${className}`}
      data-photo-focus={`${focus.x} ${focus.y}`}
      fill
      onError={onError}
      fetchPriority={fetchPriority}
      priority={priority || fetchPriority === "high"}
      preloadMedia={preloadMedia}
      ref={ref}
      sizes={sizes ?? "100vw"}
      src={src}
      style={{ ...style, objectPosition }}
    />
  );
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const pct = (value: number) => `${+(value * 100).toFixed(3)}%`;

/**
 * A Mode photo framed from its kept original (see `placePhoto`): the crop sets the scale, the
 * face holds its place, and `zoom` below 1 reveals more of the original. Where even the original
 * runs out, its edges feather into `fill`: the Appearance's blurred, photo-derived atmosphere
 * (drawn here), or "none" when the page's own atmosphere already sits behind the frame.
 *
 * The frame is measured on the client; before that (server render) `frameAspect` is used.
 */
export function FramedPhoto({ source, alt, zoom = 1, frameAspect, fill = "none", className = "", sizes, priority, preloadMedia, fetchPriority, onError, style }: {
  source: PhotoSource;
  alt: string;
  zoom?: number;
  frameAspect?: number;
  /** A CSS filter for the atmosphere layer (blur, saturate, brightness), or "none". */
  fill?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  preloadMedia?: string;
  fetchPriority?: "high" | "low" | "auto";
  onError?: ReactEventHandler<HTMLImageElement>;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  const [natural, setNatural] = useState<{ url: string; aspect: number } | null>(null);

  useIsoLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const aspect = node.clientHeight ? node.clientWidth / node.clientHeight : 0;
      if (aspect) setMeasured((current) => (current && Math.abs(current - aspect) < 0.001 ? current : aspect));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The stored size is exact for originals; a legacy photo reports its own on load.
  const aspect = natural?.url === source.url ? natural.aspect : source.aspect;
  const placement = placePhoto({ ...source, aspect }, measured ?? frameAspect ?? PHOTO_ASPECT, zoom);
  const feather = placement.covers ? undefined : featherMask(placement);
  return (
    <span className="absolute inset-0 block overflow-hidden" data-photo-covers={placement.covers ? "true" : "false"} data-photo-source={source.original ? "original" : "saved"} data-photo-zoom={Math.round(zoom * 100)} ref={ref}>
      {!placement.covers && fill !== "none" && (
        <ProfileImage alt="" aria-hidden="true" className="absolute -inset-8 size-[calc(100%+64px)] max-w-none object-cover" data-photo-atmosphere sizes="320px" src={source.url} style={{ filter: fill }} />
      )}
      <span className="absolute block" data-photo-placement={`${pct(placement.left)} ${pct(placement.top)} ${pct(placement.width)} ${pct(placement.height)}`} style={{ left: pct(placement.left), top: pct(placement.top), width: pct(placement.width), height: pct(placement.height), maskImage: feather, WebkitMaskImage: feather, maskComposite: feather ? "intersect" : undefined, WebkitMaskComposite: feather ? "source-in" : undefined }}>
        <ProfileImage
          alt={alt}
          className={`object-cover ${className}`}
          data-photo-focus={`${source.focus.x} ${source.focus.y}`}
          fill
          onError={onError}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (!source.original && image.naturalWidth && image.naturalHeight) setNatural({ url: source.url, aspect: image.naturalWidth / image.naturalHeight });
          }}
          fetchPriority={fetchPriority}
          priority={priority || fetchPriority === "high"}
          preloadMedia={preloadMedia}
          sizes={sizes ?? "100vw"}
          src={source.url}
          style={style}
        />
      </span>
    </span>
  );
}

/** Soft edges only where the image ends inside the frame, so it melts into the atmosphere. */
function featherMask(placement: PhotoPlacement) {
  const edge = (start: boolean, end: boolean, length: number) => {
    // A feather of ~10% of the frame, expressed in the image box's own percent.
    const f = Math.min(30, (0.1 / length) * 100);
    return `${start ? `#0000 0%,#000 ${f.toFixed(2)}%` : "#000 0%"},${end ? `#000 ${(100 - f).toFixed(2)}%,#0000 100%` : "#000 100%"}`;
  };
  const e = 1e-6;
  const horizontal = `linear-gradient(90deg,${edge(placement.left > e, placement.left + placement.width < 1 - e, placement.width)})`;
  const vertical = `linear-gradient(180deg,${edge(placement.top > e, placement.top + placement.height < 1 - e, placement.height)})`;
  return `${horizontal},${vertical}`;
}
