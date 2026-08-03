import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Foto (max. 2 MB) plus FormData-Metadaten zuverlässig transportieren.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
