import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.cloudinary.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year for immutable images
  },
  experimental: {
    optimizePackageImports: [
      '@phosphor-icons/react',
      '@supabase/supabase-js',
    ],
  },
}

export default nextConfig
