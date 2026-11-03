/** @type {import('next').NextConfig} */
const nextConfig = {
  // Version skew protection: клиент из старого билда получает hard navigation
  // вместо «Failed to find Server Action» после редеплоя. Сначала читаем
  // NEXT_DEPLOYMENT_ID (так значение гарантированно совпадает с env-переменной,
  // иначе next build падает с E971), затем VERCEL_DEPLOYMENT_ID.
  deploymentId:
    process.env.NEXT_DEPLOYMENT_ID ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    undefined,
  htmlLimitedBots: /.*/,
  devIndicators: false,
  experimental: {
    serverComponentsHmrCache: true,
    webpackMemoryOptimizations: true,
    preloadEntriesOnStart: false,
    // Пул PostgreSQL ограничен тремя соединениями на процесс. Уменьшаем
    // конкуренцию за них при предрендеринге, не меняя кэширование страниц.
    staticGenerationMaxConcurrency: 2,
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
  allowedDevOrigins: ['192.168.199.17', '192.168.199.13', '192.168.203.1'],
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
  async rewrites() {
    // Динамический сегмент с суффиксом ([slug].md, [slug].docx) в Next.js 16
    // теряет суффикс при построении regex маршрута, поэтому такие адреса не
    // работают как папки. Публичные адреса сохраняются через rewrite на
    // внутренние route handlers без суффикса.
    return [
      // OAuth discovery (RFC 8414 / RFC 9728). Держим реальные handlers под
      // /api/oauth/mcp, а публичные .well-known адреса отдаём rewrite'ами:
      // так маршруты не зависят от того, как Next трактует папку с точкой.
      {
        source: '/.well-known/oauth-protected-resource',
        destination: '/api/oauth/mcp/resource-metadata',
      },
      {
        source: '/.well-known/oauth-protected-resource/:path*',
        destination: '/api/oauth/mcp/resource-metadata',
      },
      {
        source: '/.well-known/oauth-authorization-server',
        destination: '/api/oauth/mcp/authorization-server-metadata',
      },
      {
        source: '/vvvvv/:slug.md',
        destination: '/api/edition-markdown/:slug',
      },
      {
        source: '/vvvvv/:slug.docx',
        destination: '/api/edition-docx/:slug',
      },
    ]
  },

  async headers() {
    // CSP не даёт случайно просочившемуся HTML превратиться в захват сессии.
    // 'unsafe-inline'/'unsafe-eval' в script-src нужны Next.js для инлайн-
    // бутстрапа; остальное закрыто, и главное — form-action и frame-ancestors.
    //
    // Единственное отличие для игр — `frame-ancestors`: игры лежат статикой в
    // public/games/<slug>/ и встраиваются в страницу-обёртку через iframe с
    // того же домена, а `'none'` запрещает вообще любое встраивание, включая
    // наше собственное. Директивы и домены в остальном совпадают, поэтому
    // собираем обе политики из одного списка.
    const cspWithFrameAncestors = (frameAncestors) =>
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://mc.yandex.ru",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' https: wss: https://mc.yandex.ru",
        "frame-src 'self' https://mc.yandex.ru",
        `frame-ancestors ${frameAncestors}`,
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
      ].join('; ')

    const csp = cspWithFrameAncestors("'none'")

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
      {
        // Только точка входа игры, а не весь `/games/*`: страницы-обёртки
        // (`/games`, `/games/[slug]`) должны остаться невстраиваемыми и
        // индексируемыми. Значения из глобального правила перекрываются по
        // ключу, остальные заголовки (nosniff, HSTS, Referrer-Policy)
        // продолжают применяться и здесь.
        source: '/games/:slug/index.html',
        headers: [
          { key: 'Content-Security-Policy', value: cspWithFrameAncestors("'self'") },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Канонический адрес игры — страница-обёртка, сам файл не индексируем.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ]
  },
}

export default nextConfig
