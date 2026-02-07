/** @type {import('next').NextConfig} */
const nextConfig = {
  // Reduce bundle size by optimizing package imports
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@radix-ui/react-icons'],
  },

  // Compress responses
  compress: true,

  // Production source maps off for smaller bundles
  productionBrowserSourceMaps: false,

  // Reduce powered-by header exposure
  poweredByHeader: false,
}

module.exports = nextConfig
