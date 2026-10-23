import type { NextConfig } from "next";

const supabaseStorageHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    deviceSizes: [320, 360, 384, 480, 640, 720, 900, 1080, 1200, 1440, 1920, 2560],
    imageSizes: [48, 96, 120, 160, 240],
    qualities: [100],
    formats: ["image/webp"],
    minimumCacheTTL: 3600,
    remotePatterns: supabaseStorageHostname ? [{
      protocol: "https",
      hostname: supabaseStorageHostname,
      port: "",
      pathname: "/storage/v1/object/sign/profile-media/**",
    }] : [],
  },
  experimental: {
    cpus: 1,
    // Next.js only nudges coding agents about security upgrades.
    agentUpgrade: "security",
  },
  async redirects() {
    return [
      { source: "/favicon.ico", destination: "/icons/setuvara-icon.png", permanent: true },
      // The old "For Events" page; Event Mode at /event covers it now.
      { source: "/events", destination: "/event", permanent: true },
      // Revenue sharing is for any project or business, not only SaaS.
      { source: "/use-cases/share-saas-revenue-publicly", destination: "/use-cases/share-revenue-publicly", permanent: true },
    ];
  },
  async headers() {
    const noIndex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/app", headers: noIndex },
      { source: "/app/:path*", headers: noIndex },
      { source: "/api/:path*", headers: noIndex },
      { source: "/auth/:path*", headers: noIndex },
      { source: "/connect/:path*", headers: noIndex },
      { source: "/connections/:path*", headers: noIndex },
      { source: "/q/:path*", headers: noIndex },
      { source: "/t/:path*", headers: noIndex },
      { source: "/internal/:path*", headers: noIndex },
      // Event and Business share links are private pointers: keep the page and its card image out of search.
      { source: "/s/:path*", headers: noIndex },
      { source: "/og/s/:path*", headers: noIndex },
    ];
  },
  outputFileTracingIncludes: {
    // Social card fonts are read from disk at request time.
    "/og/**": ["./assets/og/*.ttf"],
    "/api/wallet/apple": ["./public/email/setuvara-mark.png"],
    "/api/wallet/apple/v1/passes/*": ["./public/email/setuvara-mark.png"],
  },
};

export default nextConfig;
