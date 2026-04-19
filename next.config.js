/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/api/**": ["./data/**/*.yaml"],
    },
  },
};

module.exports = nextConfig;
