/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {
    serverComponentsHmrCache: true,
    webpackMemoryOptimizations: true,
    preloadEntriesOnStart: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: '**.litres.ru',
      },
      {
        protocol: 'https',
        hostname: '**.author.today',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  allowedDevOrigins: ['192.168.199.12', '192.168.199.13', '192.168.203.1'],
  // OG-картинки читают .ttf через fs по пути из process.cwd() — статический
  // анализ такой импорт не видит, и без явного включения шрифты не попадут в
  // serverless-бандл, а satori отрисует кириллицу квадратами.
  outputFileTracingIncludes: {
    '/opengraph-image': ['./assets/og/**'],
    '/**/opengraph-image': ['./assets/og/**'],
  },
  logging: {
    serverFunctions: false,
  },
  async headers() {
    // CSP не даёт случайно просочившемуся HTML превратиться в захват сессии.
    // 'unsafe-inline'/'unsafe-eval' в script-src нужны Next.js для инлайн-
    // бутстрапа; остальное закрыто, и главное — form-action и frame-ancestors.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://mc.yandex.ru",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss: https://mc.yandex.ru",
      "frame-src 'self' https://mc.yandex.ru",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
}

export default nextConfig
