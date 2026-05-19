import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "tesseract.js"],

  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },

  // Production-safe headers: allow camera + mic on HTTPS, set security defaults
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow camera and microphone — required for factory-floor capture features
          { key: "Permissions-Policy", value: "camera=*, microphone=*" },
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer policy
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
