import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/analysis/:slug",
        destination: "/r/:slug",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
