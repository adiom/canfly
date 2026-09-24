'use client'

import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-3 mb-12" aria-label="canfly">
          <span className="flex h-9 w-16 items-center justify-center bg-cf-accent text-lg font-black uppercase tracking-[-0.04em] text-white">
            canfly
          </span>
        </Link>

        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cf-accent mb-4">
          Ошибка
        </p>
        <h1 className="text-4xl font-black uppercase leading-none text-cf-text-heading mb-4 md:text-5xl">
          Что-то пошло не так
        </h1>
        <p className="leading-7 text-cf-text-caption mb-10">
          Произошла непредвиденная ошибка. Попробуйте обновить страницу
          или вернитесь на главную.
          {process.env.NODE_ENV === 'development' && error?.message && (
            <span className="block mt-3 font-mono text-xs text-cf-text-3 break-all">
              {error.message}
            </span>
          )}
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => window.location.reload()}
            className="h-12 px-5 bg-cf-accent text-white font-black uppercase text-sm tracking-[0.1em] hover:bg-[#b81e1e] transition-colors"
          >
            Обновить страницу
          </button>
          <button
            onClick={reset}
            className="h-12 px-5 border border-cf-text-1/18 text-cf-text-1 font-bold uppercase text-sm tracking-[0.1em] hover:bg-cf-text-1/8 transition-colors"
          >
            Попробовать снова
          </button>
          <Link
            href="/"
            className="h-12 px-5 border border-cf-text-1/18 text-cf-text-1 font-bold uppercase text-sm hover:bg-cf-text-1/8 transition-colors inline-flex items-center"
          >
            На главную
          </Link>
        </div>
      </div>
    </main>
  )
}
