/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pg', 'web-push', 'cheerio', 'rss-parser'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}

module.exports = nextConfig
