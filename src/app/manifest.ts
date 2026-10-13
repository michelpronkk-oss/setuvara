import type { MetadataRoute } from "next";

import { LAUNCH_START_URL } from "@/lib/pwa/launch";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Setuvara",
    short_name: "Setuvara",
    description: "Your identity for real life. Open it and your QR is ready to show.",
    start_url: LAUNCH_START_URL,
    scope: "/",
    display: "standalone",
    background_color: "#F5F4EF",
    theme_color: "#F5F4EF",
    icons: [
      { src: "/icons/setuvara-app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/setuvara-app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/setuvara-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
