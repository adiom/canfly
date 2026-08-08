/**
 * Оформление страницы входа: поля на нижней линейке, прямоугольные кнопки,
 * служебные подписи моноширинным. Вынесено отдельно, потому что делится между
 * `app/login/**` и `components/magic-link-form.tsx`.
 * Цвета — только токены `cf-*`, чтобы страница жила в обеих темах.
 */

export const LOGIN_SERIF = "var(--font-cormorant, 'Cormorant Garamond', Georgia, serif)"

export const LOGIN_EYEBROW = 'font-mono text-[9px] uppercase tracking-[0.22em] text-cf-accent'

export const LOGIN_LABEL = 'font-mono text-[9px] uppercase tracking-[0.22em] text-cf-text-4'

/** Поле без рамки: рамку заменяет линейка, поэтому фокус красит именно её. */
export const LOGIN_FIELD =
  'w-full border-0 border-b border-cf-text-1/20 bg-transparent px-0 py-3 text-base text-cf-text-1 outline-none transition-colors placeholder:text-cf-text-4/60 focus:border-cf-accent disabled:opacity-50'

export const LOGIN_PRIMARY =
  'w-full bg-cf-accent px-4 py-3.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white transition-colors hover:bg-cf-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cf-accent disabled:cursor-not-allowed disabled:opacity-60'

export const LOGIN_GHOST =
  'w-full border border-cf-text-1/15 px-4 py-3.5 font-mono text-[10px] uppercase tracking-[0.2em] text-cf-text-3 transition-colors hover:border-cf-text-1/35 hover:text-cf-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cf-accent'

/** Сообщение об ошибке — не плашка, а строка с акцентной линейкой слева. */
export const LOGIN_NOTE =
  'border-l-2 border-cf-accent pl-3 font-mono text-[11px] leading-relaxed text-cf-text-2'
