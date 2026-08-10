'use client'

export default function CharactersError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6 py-24 text-center">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-cf-text-3">персонажи вселенной</p>
        <h1 className="mt-4 text-3xl font-light text-cf-text-heading">Не удалось загрузить героев</h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-cf-text-3">
          Попробуйте обновить страницу ещё раз.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 rounded-full border border-cf-air-line px-5 py-3 text-[11px] uppercase tracking-[0.2em] text-cf-text-2 transition-colors hover:bg-cf-air-surface-2 hover:text-cf-text-heading"
        >
          Повторить
        </button>
      </div>
    </main>
  )
}
