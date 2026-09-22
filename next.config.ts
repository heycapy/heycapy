import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const appUrl = process.env.APP_URL;
const devOrigins = appUrl ? [new URL(appUrl).host] : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  output: "standalone",
  logging: {
    serverFunctions: false,
  },
  ...(isProd && {
    headers: async () => [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ],
  }),
};

export default nextConfig;
