import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/**" },
      { protocol: "https", hostname: "s4.anilist.co", pathname: "/**" },
      { protocol: "https", hostname: "img.anili.st", pathname: "/**" },
    ],
  },
  experimental: {
    serverActions: {
      // Next.js defaults to 1MB. Import uploads go through a Server Action, so
      // the limit has to be raised explicitly. Kept at 4MB to stay under
      // Vercel's 4.5MB serverless request-body cap; the import action validates
      // against the same number so users get a clear message instead of a 413.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
