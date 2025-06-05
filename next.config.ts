import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
      {
        hostname: 't.me',
      },
      {
        protocol: 'https',
        hostname: '*.telegram-cdn.org',
      },
    ],
  },
};

export default nextConfig;
