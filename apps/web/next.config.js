/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove 'output: export' for dynamic routes to work
  // output: 'export',
  reactStrictMode: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

module.exports = nextConfig;