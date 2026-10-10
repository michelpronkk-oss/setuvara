import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
  },
  outputFileTracingIncludes: {
    "/api/wallet/apple": ["./public/email/setuvara-mark.png"],
    "/api/wallet/apple/v1/passes/*": ["./public/email/setuvara-mark.png"],
  },
};

export default nextConfig;
