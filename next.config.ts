import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
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
    ];
  },
  outputFileTracingIncludes: {
    "/api/wallet/apple": ["./public/email/setuvara-mark.png"],
    "/api/wallet/apple/v1/passes/*": ["./public/email/setuvara-mark.png"],
  },
};

export default nextConfig;
