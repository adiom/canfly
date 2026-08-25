import Link from 'next/link'
import { Suspense } from 'react'
import { BookOpen, UserRound } from 'lucide-react'

import { HomeHeroSlider } from '@/components/home-hero-slider'
import { HomeIssuesSection } from '@/components/home-issues-section'
import { HomeNewsSection } from '@/components/home-news-section'
import {
  getPublicHomepageSlides,
  isHomepageSlidesTableMissing,
} from '@/lib/homepage-slide-store'
import { HomepageSlide } from '@/lib/types'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { generateWebPageSchema } from '@/lib/seo/schema'
import { JsonLd } from '@/components/seo/json-ld'
import { buildMetadata } from '@/lib/seo/metadata'
import { CATALOG_PATH, LANDING_PATH } from '@/lib/nav'

export const revalidate = 60

const LANDING_DESCRIPTION =
  'canfly — литературная вселенная о тревоге, ремесле, памяти, цифровой усталости и людях, которые продолжают функционировать.'

export const metadata = buildMetadata({
  title: 'canfly | культура твоего сознания',
  description: LANDING_DESCRIPTION,
  path: LANDING_PATH,
})

export default async function Home() {
  let slides: HomepageSlide[] = []
  let isMigrationMissing = false

  try {
    slides = await getPublicHomepageSlides()
  } catch (error) {
    if (!isHomepageSlidesTableMissing(error)) {
      throw error
    }

    isMigrationMissing = true
  }

  const pageSchema = generateWebPageSchema({
    name: 'canfly | культура твоего сознания',
    description: LANDING_DESCRIPTION,
    path: LANDING_PATH,
  })

  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <h1 className="sr-only">canfly — культура твоего сознания</h1>
      <JsonLd schemas={[pageSchema]} />
      <SiteHeader activePath={LANDING_PATH} />

      {slides.length > 0 ? (
        <HomeHeroSlider slides={slides} />
      ) : (
        <section className="border-b border-cf-text-1/10 bg-cf-bg px-4 py-24 md:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-cf-accent">
              hero-слайдер
            </p>
            <h2 className="max-w-4xl text-5xl font-black uppercase leading-none text-cf-text-heading md:text-7xl">
              {isMigrationMissing ? 'Создайте таблицу слайдера' : 'Добавьте первый слайд в админке'}
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-cf-text-caption">
              {isMigrationMissing
                ? 'Главная страница больше не использует fallback. Выполните SQL из `postgres/schema.sql`, чтобы создать `homepage_slides` в Postgres.'
                : 'Главная страница читает слайды только из таблицы Postgres `homepage_slides`.'}
            </p>
            <Link
              href="/admin"
              className="mt-8 inline-flex h-12 items-center rounded-sm bg-cf-warm px-5 text-sm font-black uppercase text-cf-text-heading"
            >
              Открыть админку
            </Link>
          </div>
        </section>
      )}

      <Suspense fallback={
        <section id="issues" className="border-b border-cf-text-1/10 bg-cf-bg-2 px-4 py-12 text-cf-text-1 md:px-8 md:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-cf-accent">новые выпуски</p>
              <div className="h-12 w-40 animate-pulse rounded bg-cf-text-1/10" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[4/5] rounded bg-cf-text-1/10" />
                  <div className="mt-3 h-6 rounded bg-cf-text-1/10" />
                </div>
              ))}
            </div>
          </div>
        </section>
      }>
        <HomeIssuesSection />
      </Suspense>

      <Suspense fallback={
        <section id="news" className="border-b border-cf-text-1/10 bg-cf-bg px-4 py-12 md:px-8 md:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-cf-accent">canfly dispatch</p>
              <div className="h-12 w-60 animate-pulse rounded bg-cf-text-1/10" />
            </div>
          </div>
        </section>
      }>
        <HomeNewsSection />
      </Suspense>

      <section id="worlds" className="bg-cf-bg-2 px-4 py-12 md:px-8 md:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-cf-accent">
              explore canfly
            </p>
            <h2 className="text-2xl font-black uppercase leading-none text-cf-text-heading sm:text-3xl md:text-5xl">
              Входы во вселенную
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Link href={CATALOG_PATH} className="group border border-cf-text-1/10 bg-cf-bg p-4 hover:border-cf-warm/45 sm:p-6">
              <BookOpen className="mb-8 h-7 w-7 text-cf-warm sm:mb-10" />
              <h3 className="text-xl font-black uppercase text-cf-text-heading sm:text-2xl">Книги</h3>
              <p className="mt-3 leading-7 text-cf-text-caption sm:mt-4">Романы, повести и циклы как самостоятельные точки входа.</p>
            </Link>
            <Link href="/characters" className="group border border-cf-text-1/10 bg-cf-bg p-4 hover:border-cf-blue/45 sm:p-6">
              <UserRound className="mb-7 h-7 w-7 text-cf-blue sm:mb-10" />
              <h3 className="text-xl font-black uppercase text-cf-text-heading sm:text-2xl">Персонажи</h3>
              <p className="mt-3 leading-7 text-cf-text-caption sm:mt-4">Люди функции: швеи, инженеры, операторы, сотрудники ПВЗ.</p>
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter variant="full" />
    </main>
  )
}
