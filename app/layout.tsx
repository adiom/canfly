import type { Metadata } from 'next'
import { Geist, Geist_Mono, Cormorant_Garamond, EB_Garamond, Libre_Franklin } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { CartProvider } from '@/lib/cart-context'
import { ThemeProvider } from '@/components/theme-provider'
import { generateOrganizationSchema, serializeJsonLd } from '@/lib/seo/schema'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { YandexMetrika } from '@/components/yandex-metrika'
import { FeedbackWidget } from '@/components/feedback-widget'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
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
const organizationSchema = generateOrganizationSchema(BASE_URL)

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} ${ebGaramond.variable} ${libreFranklin.variable}`}>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationSchema) }}
        />
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <Analytics />
            <SpeedInsights/>
            <CartProvider>
              {children}
            </CartProvider>
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
