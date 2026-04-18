/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // data/ 配下の YAML ファイルを Vercel serverless bundle に含める
  // （fs.readFileSync で読むので Next.js の自動トレースが拾わない）
  outputFileTracingIncludes: {
    "/api/**": ["./data/**/*.yaml"],
  },
};

module.exports = nextConfig;
