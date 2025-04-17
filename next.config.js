/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Configure the output directory to match our existing structure
  distDir: 'dist/.next',
  // Make sure Next.js knows this is partially a static site
  trailingSlash: true,
  // Configure assets and images
  images: {
    domains: ['oerschema.org'],
  },
  // Removed rewrites section to avoid conflict with vercel.json routes
};

export default nextConfig;