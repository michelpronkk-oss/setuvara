"use client";

import { getImageProps } from "next/image";
import { forwardRef, useEffect, useState, type ImgHTMLAttributes, type ReactEventHandler } from "react";

/**
 * Use Next's image optimizer only for signed images in Setuvara's private Storage bucket.
 * If an optimizer request fails, retry the same signed URL directly to preserve availability.
 */
type ProfileImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes"> & {
  src: string;
  sizes?: string;
  priority?: boolean;
  preloadMedia?: string;
  deferUntilLcp?: boolean;
  fill?: boolean;
};

export const ProfileImage = forwardRef<HTMLImageElement, ProfileImageProps>(function ProfileImage({
  src,
  alt = "",
  className = "",
  sizes = "100vw",
  priority = false,
  preloadMedia,
  deferUntilLcp = false,
  fill = false,
  fetchPriority,
  loading,
  onError,
  ...imageProps
}, ref) {
  const [fallbackSource, setFallbackSource] = useState<string | null>(null);
  const shouldDefer = deferUntilLcp && isSignedProfileMediaUrl(src);
  const [lcpSource, setLcpSource] = useState<string | null>(null);
  const lcpObserved = !shouldDefer || lcpSource === src;
  useEffect(() => {
    if (!shouldDefer || lcpObserved) return;
    let observer: PerformanceObserver | null = null;
    const fallback = window.setTimeout(() => setLcpSource(src), 5000);
    if ("PerformanceObserver" in window) {
      observer = new PerformanceObserver((list) => {
        if (list.getEntries().length) {
          setLcpSource(src);
          observer?.disconnect();
        }
      });
      try {
        observer.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
        setLcpSource(src);
      }
    } else {
      setLcpSource(src);
    }
    return () => {
      window.clearTimeout(fallback);
      observer?.disconnect();
    };
  }, [lcpObserved, shouldDefer, src]);

  const activeSrc = shouldDefer && !lcpObserved ? null : src;
  const optimized = activeSrc !== null && isSignedProfileMediaUrl(activeSrc) && fallbackSource !== activeSrc;
  const resolvedFetchPriority = preloadMedia ? "auto" : fetchPriority ?? (priority ? "high" : "low");
  const resolvedLoading = preloadMedia ? "lazy" : loading ?? (priority ? "eager" : "lazy");
  const responsive = optimized ? getImageProps({
    alt,
    fill: true,
    fetchPriority: resolvedFetchPriority,
    loading: resolvedLoading,
    quality: 100,
    sizes,
    src: activeSrc!,
  }).props : null;

  const handleError: ReactEventHandler<HTMLImageElement> = (event) => {
    if (optimized) {
      setFallbackSource(activeSrc!);
      return;
    }
    onError?.(event);
  };

  return (
    <>
      {preloadMedia && activeSrc && <link as="image" fetchPriority="high" href={responsive?.src ?? activeSrc} imageSizes={responsive?.sizes ?? (responsive ? sizes : undefined)} imageSrcSet={responsive?.srcSet} media={preloadMedia} rel="preload" />}
      <img
        {...imageProps}
        alt={alt}
        className={className}
        decoding="async"
        fetchPriority={resolvedFetchPriority}
        loading={resolvedLoading}
        onError={handleError}
        ref={ref}
        sizes={responsive?.sizes ?? sizes}
        src={responsive?.src ?? activeSrc ?? undefined}
        srcSet={responsive?.srcSet}
        style={fill ? {
          ...responsive?.style,
          position: "absolute",
          height: "100%",
          width: "100%",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          ...imageProps.style,
        } : imageProps.style}
      />
      {shouldDefer && !lcpObserved && <noscript><img alt={alt} className={className} decoding="async" loading="lazy" sizes={sizes} src={src} style={imageProps.style} /></noscript>}
    </>
  );
});

function isSignedProfileMediaUrl(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === "https:"
      && url.pathname.startsWith("/storage/v1/object/sign/profile-media/");
  } catch {
    return false;
  }
}
