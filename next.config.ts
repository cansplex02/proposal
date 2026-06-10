import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/analysis/:slug",
        destination: "/analysis",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
