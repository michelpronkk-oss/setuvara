"use client";

import { useState, type CSSProperties } from "react";

export function ConnectionAvatar({
  imageUrl,
  name,
  className,
  style,
}: {
  imageUrl: string | null;
  name: string;
  className: string;
  style?: CSSProperties;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial = name.trim().slice(0, 1).toUpperCase() || "S";

  return (
    <span aria-hidden="true" className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`} style={style}>
      {initial}
      {/* eslint-disable-next-line @next/next/no-img-element -- private, RLS-authorized signed connection photo */}
      {imageUrl && imageUrl !== failedUrl && <img alt="" className="absolute inset-0 size-full object-cover" decoding="async" loading="lazy" onError={() => setFailedUrl(imageUrl)} src={imageUrl} />}
    </span>
  );
}
