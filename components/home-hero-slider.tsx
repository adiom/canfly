'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'

import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel'
import { HomepageSlide } from '@/lib/types'

const themeStyles = {
  atelier: {
    accent: '#f6d6a8',
    wash: 'rgba(246, 214, 168, 0.20)',
    label: 'мастерская',
  },
  'night-city': {
    accent: '#9db5c8',
    wash: 'rgba(157, 181, 200, 0.20)',
    label: 'ночной город',
  },
  pvz: {
    accent: '#d7c6ad',
    wash: 'rgba(215, 198, 173, 0.18)',
    label: 'логистика',
  },
  volga: {
    accent: '#b9c7b3',
    wash: 'rgba(185, 199, 179, 0.18)',
    label: 'волга',
  },
  dreams: {
    accent: '#c7bddf',
    wash: 'rgba(199, 189, 223, 0.18)',
    label: 'мир снов',
  },
}

interface HomeHeroSliderProps {
  slides: HomepageSlide[]
}

export function HomeHeroSlider({ slides }: HomeHeroSliderProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectedSlide = slides[selectedIndex] || slides[0]
  const currentTheme = themeStyles[selectedSlide?.theme || 'atelier']

  const onSelect = useCallback((carouselApi: CarouselApi) => {
    if (!carouselApi) return
    setSelectedIndex(carouselApi.selectedScrollSnap())
  }, [])

  useEffect(() => {
    if (!api) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- subscribing to carousel API
    onSelect(api)
    api.on('select', onSelect)
    api.on('reInit', onSelect)

    return () => {
      api.off('select', onSelect)
      api.off('reInit', onSelect)
    }
  }, [api, onSelect])

  useEffect(() => {
    if (!api || slides.length < 2) return

    const interval = window.setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext()
      } else {
        api.scrollTo(0)
      }
    }, 8500)

    return () => window.clearInterval(interval)
  }, [api, slides.length])

  const slideNumbers = useMemo(
    () => slides.map((slide, index) => ({ id: slide.id, label: String(index + 1).padStart(2, '0') })),
    [slides],
  )

  return (
    <section className="relative overflow-hidden border-b border-cf-text-1/10 bg-cf-bg">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(128,128,128,0.06)_1px,transparent_1px),linear-gradient(180deg,rgba(128,128,128,0.04)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
      <div
        className="absolute inset-0 transition-colors duration-500 pointer-events-none md:hidden"
        style={{
          background: `radial-gradient(circle at 50% 15%, ${currentTheme.wash}, transparent 34%), linear-gradient(180deg, rgba(17,18,16,0.18), var(--cf-bg) 92%)`,
        }}
      />
      <div
        className="absolute inset-0 transition-colors duration-500 pointer-events-none hidden md:block"
        style={{
          background: `radial-gradient(circle at 75% 22%, ${currentTheme.wash}, transparent 34%), linear-gradient(180deg, rgba(17,18,16,0.18), var(--cf-bg) 92%)`,
        }}
      />

      <Carousel setApi={setApi} opts={{ loop: true, align: 'start' }} className="relative">
        <CarouselContent className="ml-0">
          {slides.map((slide, index) => {
            const theme = themeStyles[slide.theme]
            const asideLabel = slide.aside_label?.trim() || 'Дополнения'
            const asideNumber =
              slide.aside_number?.trim() || String(index + 1).padStart(2, '0')
            const asideText = slide.aside_text?.trim()

            return (
              <CarouselItem key={slide.id} className="pl-0">
                <article className="relative min-h-[calc(100vh-108px)] overflow-hidden md:min-h-[680px]">
                  {slide.background_image || slide.mobile_image ? (
                    <>
                      {slide.mobile_image ? (
                        <div
                          className="absolute inset-0 bg-cover bg-center opacity-[0.58] pointer-events-none md:hidden"
                          style={{ backgroundImage: `url(${slide.mobile_image})` }}
                        />
                      ) : null}
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-[0.58] pointer-events-none hidden md:block"
                        style={{ backgroundImage: `url(${slide.background_image})` }}
                      />
                    </>
                  ) : (
                    <SlideAtmosphere theme={slide.theme} />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--cf-bg)_0%,color-mix(in_srgb,var(--cf-bg)_92%,transparent)_34%,color-mix(in_srgb,var(--cf-bg)_58%,transparent)_62%,color-mix(in_srgb,var(--cf-bg)_82%,transparent)_100%)] pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(180deg,transparent,var(--cf-bg))] pointer-events-none" />

                  <div className="relative mx-auto grid min-h-[calc(100vh-108px)] max-w-7xl items-center px-4 py-10 md:min-h-[680px] md:px-8 md:py-16 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="max-w-4xl">
                      <p
                        className="mb-4 inline-flex border-l px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] sm:mb-5 sm:px-3 sm:py-2 sm:text-xs"
                        style={{
                          borderColor: theme.accent,
                          backgroundColor: `${theme.accent}14`,
                          color: theme.accent,
                        }}
                      >
                        {slide.eyebrow || theme.label}
                      </p>
                      <h2 className="max-w-4xl text-4xl font-black uppercase leading-[0.88] tracking-normal text-cf-text-heading text-balance sm:text-5xl md:text-6xl lg:text-8xl">
                        {slide.title}
                      </h2>
                      {slide.description ? (
                        <p className="mt-7 max-w-2xl text-base leading-7 text-cf-text-2 md:text-lg lg:text-xl">
                          {slide.description}
                        </p>
                      ) : null}
                      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                        {slide.primary_cta_label && slide.primary_cta_href ? (
                          <Link
                            href={slide.primary_cta_href}
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-sm px-5 text-sm font-bold uppercase text-cf-bg transition-transform hover:-translate-y-0.5"
                            style={{ backgroundColor: theme.accent }}
                          >
                            {slide.primary_cta_label}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        ) : null}
                        {slide.secondary_cta_label && slide.secondary_cta_href ? (
                          <Link
                            href={slide.secondary_cta_href}
                            className="inline-flex h-12 items-center justify-center rounded-sm border border-cf-text-1/18 px-5 text-sm font-bold uppercase text-cf-text-1 transition-colors hover:bg-cf-text-1/8"
                          >
                            {slide.secondary_cta_label}
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-10 hidden border-l border-cf-text-1/12 pl-6 lg:block">
                      <p className="text-xs uppercase tracking-[0.24em] text-cf-text-3">{asideLabel}</p>
                      <p className="mt-4 text-7xl font-black leading-none text-cf-text-1/12">
                        {asideNumber}
                      </p>
                      {asideText ? (
                        <p className="mt-5 max-w-xs text-sm leading-6 text-cf-text-caption">{asideText}</p>
                      ) : null}
                    </div>
                  </div>
                </article>
              </CarouselItem>
            )
          })}
        </CarouselContent>

        <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-cf-text-1/10 bg-cf-bg/88 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
              {slideNumbers.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => api?.scrollTo(index)}
                  className={`h-12 min-w-14 cursor-pointer touch-manipulation border-b-2 px-3 text-left text-sm font-black transition-colors ${
                    selectedIndex === index
                      ? 'border-cf-warm text-cf-warm'
                      : 'border-transparent text-cf-text-4 hover:text-cf-text-1'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => api?.scrollPrev()}
                className="flex h-10 w-10 cursor-pointer touch-manipulation items-center justify-center rounded-sm border border-cf-text-1/14 text-cf-text-1 hover:bg-cf-text-1/8"
                aria-label="Предыдущий слайд"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => api?.scrollNext()}
                className="flex h-10 w-10 cursor-pointer touch-manipulation items-center justify-center rounded-sm border border-cf-text-1/14 text-cf-text-1 hover:bg-cf-text-1/8"
                aria-label="Следующий слайд"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </Carousel>
    </section>
  )
}

function SlideAtmosphere({ theme }: { theme: HomepageSlide['theme'] }) {
  if (theme === 'night-city') {
    return (
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-cf-bg-2 pointer-events-none" />
        <div className="absolute left-[58%] top-20 h-[520px] w-[320px] border border-[#9db5c8]/30 bg-[#9db5c8]/10 pointer-events-none" />
        <div className="absolute bottom-24 right-16 h-3 w-80 bg-[#9db5c8]/30 pointer-events-none" />
        <div className="absolute bottom-32 right-28 h-24 w-44 border border-cf-text-1/16 bg-cf-text-1/6 pointer-events-none" />
      </div>
    )
  }

  if (theme === 'pvz') {
    return (
      <div className="absolute inset-0 pointer-events-none bg-cf-bg">
        <div className="absolute right-20 top-20 grid grid-cols-4 gap-3 opacity-80 pointer-events-none">
          {Array.from({ length: 24 }).map((_, index) => (
            <span key={index} className="h-20 w-24 border border-[#d7c6ad]/30 bg-[#d7c6ad]/14 pointer-events-none" />
          ))}
        </div>
      </div>
    )
  }

  if (theme === 'volga') {
    return (
      <div className="absolute inset-0 pointer-events-none bg-cf-bg">
        <div className="absolute bottom-36 right-0 h-24 w-[58%] border-y border-[#b9c7b3]/24 bg-[#b9c7b3]/14 pointer-events-none" />
        <div className="absolute right-20 top-24 h-72 w-72 border border-[#b9c7b3]/28 pointer-events-none" />
      </div>
    )
  }

  if (theme === 'dreams') {
    return (
      <div className="absolute inset-0 pointer-events-none bg-cf-bg">
        <div className="absolute right-24 top-24 h-72 w-72 rounded-full border border-[#c7bddf]/28 bg-[#c7bddf]/10 pointer-events-none" />
        <div className="absolute bottom-24 right-40 h-44 w-28 border border-[#c7bddf]/24 bg-[#c7bddf]/12 pointer-events-none" />
      </div>
    )
  }

  return (
    <div className="absolute inset-0 pointer-events-none bg-cf-bg">
      <div className="absolute right-20 top-16 h-[480px] w-[360px] border border-[#f6d6a8]/28 bg-[#f6d6a8]/14 pointer-events-none" />
      <div className="absolute bottom-24 right-32 h-28 w-64 border border-[#f6d6a8]/28 bg-[#f6d6a8]/16 pointer-events-none" />
      <div className="absolute right-44 top-48 h-80 w-px bg-[#f6d6a8]/50 pointer-events-none" />
    </div>
  )
}
