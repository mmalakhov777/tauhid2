/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Disable PPR to prevent build-time API route analysis
    ppr: false,
  },
  // Render.com specific optimizations
  compress: true,
  poweredByHeader: false,
  eslint: {
    // Disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript errors during builds
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
  // Skip static optimization for API routes
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  // Disable static page generation for problematic routes
  async rewrites() {
    return [];
  },
  redirects: async () => {
    return [
      {
        source: '/github',
        destination: 'https://github.com/vercel/ai-chatbot',
        permanent: true,
      },
      {
        source: '/deploy',
        destination: 'https://vercel.com/templates/next.js/ai-chatbot',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig; 