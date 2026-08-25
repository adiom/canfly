import type { Metadata } from 'next'
import { Geist, Geist_Mono, Cormorant_Garamond, EB_Garamond, Libre_Franklin } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/components/theme-provider'
import { organizationNode, authorNode } from '@/lib/seo/entities'
import { JsonLd } from '@/components/seo/json-ld'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { YandexMetrika } from '@/components/yandex-metrika'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})
const ebGaramond = EB_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-ebgaramond',
  preload: false,
  display: 'swap',
})
const libreFranklin = Libre_Franklin({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  variable: '--font-libre-franklin',
  preload: false,
  display: 'swap',
})

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: 'canfly | культура твоего сознания',
  description: 'Артхаусное издательство с комиксами, книгами и аудиокнигами. Встреться с персонажами и поговори с ними через AI.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'canfly | культура твоего сознания',
    description: 'Артхаусное издательство с комиксами, книгами и аудиокнигами. Встреться с персонажами и поговори с ними через AI.',
    url: BASE_URL,
    siteName: 'canfly',
    locale: 'ru_RU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
}
/**
 * Полные узлы Organization и Person отдаются ровно один раз — из layout.
 * Остальные страницы ссылаются на них по `@id`, поэтому Google склеивает
 * издательство и автора в одну сущность вместо безымянной копии на страницу.
 */
const siteSchemas = [organizationNode(), authorNode()]

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} ${ebGaramond.variable} ${libreFranklin.variable}`}>
      <body className="font-sans antialiased">
        <JsonLd schemas={siteSchemas} />
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <Analytics />
            <SpeedInsights/>
              {children}
          </ThemeProvider>
        </SessionProvider>
        <YandexMetrika />
        {process.env.NODE_ENV === 'development' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
window.addEventListener('unhandledrejection', function(e) {
  if (e.reason && e.reason.name === 'ChunkLoadError') {
    console.warn('[dev] ChunkLoadError (async) detected');
    e.preventDefault();
  }
});
`,
            }}
          />
        )}
      </body>
    </html>
  )
}
