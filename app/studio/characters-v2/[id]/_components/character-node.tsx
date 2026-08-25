import type { ReactNode } from 'react'
import type { LifeState } from '@/lib/server/character-completeness'
import { LifeStateIndicator } from './life-state'

/**
 * Glass node — атомная карточка секции «дела» персонажа в orbital-стиле:
 *   rounded-[28px] bg-white/72 backdrop-blur-2xl ring-1 ring-white/70
 *   shadow-[0_24px_80px_rgba(15,23,42,0.10)]
 *
 * Шапка: caps-eyebrow заголовок (tracking +0.34em) + life-state индикатор,
 * справа — произвольный aside (кнопки «Версии», «Удалить» и т. п.).
 * Тело — children. Чистый серверный компонент; aside и children могут
 * содержать клиентские элементы (они рендерятся как есть).
 */
export function CharacterNode({
  id,
  title,
  state,
  eyebrow,
  aside,
  children,
  className = '',
}: {
  id: string
  title: string
  state: LifeState
  /** Короткая подпись над заголовком — номер «листа дела» или метка. */
  eyebrow?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 rounded-[28px] bg-white/72 backdrop-blur-2xl ring-1 ring-white/70 shadow-[0_24px_80px_rgba(15,23,42,0.10)] px-5 py-5 md:px-7 md:py-6 ${className}`}
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="text-[11px] font-medium uppercase tracking-[0.34em] text-neutral-400">
              {eyebrow}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-3">
            <h2 className="text-[15px] font-medium tracking-[-0.01em] text-neutral-900">
              {title}
            </h2>
            <LifeStateIndicator state={state} size={9} />
          </div>
        </div>
        {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
      </header>
      {children}
    </section>
  )
}
