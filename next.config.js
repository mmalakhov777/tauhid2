/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    ppr: true,
  },
  eslint: {
    // Disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
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