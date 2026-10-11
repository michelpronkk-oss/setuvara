import type { MetadataRoute } from "next";

import { SETUVARA_ORIGIN } from "@/lib/marketing/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/app/",
        "/auth/",
        "/api/",
        "/internal/",
        "/connections/",
        "/connect/",
        "/q/",
        "/t/",
      ],
    },
    sitemap: `${SETUVARA_ORIGIN}/sitemap.xml`,
  };
}
