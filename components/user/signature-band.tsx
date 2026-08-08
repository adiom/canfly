import type { SignatureTheme } from '@/lib/user-signature'

/**
 * Полоса-паспорт: кадр неба из каталога цветов canfly, закреплённый за читателем.
 * Цвет приходит инлайном — он у каждого свой, токеном его не выразить.
 */
export function SignatureBand({ theme, caption }: { theme: SignatureTheme; caption?: string }) {
  const { color, ink, inkSoft } = theme

  return (
    <div
      className="relative flex h-32 items-end overflow-hidden md:h-40"
      style={{ backgroundColor: color.hex }}
    >
      {/* Плотность к низу — как в осадочном слое: свежее сверху, древнее внизу */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,0.18))' }}
      />
      <div className="relative mx-auto flex w-full max-w-7xl items-end justify-between gap-4 px-4 pb-4 md:px-8">
        <div>
          {caption && (
            <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: inkSoft }}>
              {caption}
            </p>
          )}
          <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: ink }}>
            {color.id} · {color.name}
          </p>
          <p className="mt-1 text-sm italic" style={{ color: inkSoft }}>
            {color.subtitle}
          </p>
        </div>
        <p
          className="hidden font-mono text-[9px] uppercase tracking-[0.2em] sm:block"
          style={{ color: inkSoft }}
        >
          {color.era}
        </p>
      </div>
    </div>
  )
}
