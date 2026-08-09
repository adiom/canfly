import * as React from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[12px]',
  md: 'h-10 px-4 text-[13px]',
  lg: 'h-12 px-5 text-[14px]',
}

/**
 * Glass-кнопка в духе orbital: тёмные чернила для primary, прозрачное стекло
 * для ghost, тихий danger без агрессии. Никаких «violet-600/red-600» —
 * это локальный стиль Studio, который мы постепенно вытесняем.
 *
 * Используется через `<form action={...}>` (server action) или `onClick`.
 * Для ссылок оборачивайте в `<Link>` снаружи, либо передавайте `asChild` —
 * но в текущей Studio проще делать `<Button asChild>` через shadcn-слот,
 * а этот компонент оставим «голым» для новых блоков.
 */
export const GlassButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant
    size?: Size
  }
>(function GlassButton(
  { variant = 'ghost', size = 'md', className, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      // type="submit" по умолчанию для форм — это самая частая ошибка,
      // когда кнопка случайно сабмитит соседнюю форму.
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-medium',
        'tracking-[0.04em] transition-all duration-300 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cf-air-accent/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        SIZE[size],
        variant === 'primary' &&
          'bg-cf-text-heading text-cf-bg shadow-[var(--cf-air-shadow)] hover:bg-cf-text-1',
        variant === 'ghost' &&
          'bg-white/70 text-cf-text-2 ring-1 ring-white/70 backdrop-blur-xl hover:bg-white/85 hover:text-cf-text-heading',
        variant === 'subtle' &&
          'bg-cf-air-surface text-cf-text-2 backdrop-blur-xl hover:bg-cf-air-surface-2',
        variant === 'danger' &&
          'bg-red-50/80 text-red-700 ring-1 ring-red-200/80 backdrop-blur-xl hover:bg-red-100/80',
        className,
      )}
      {...props}
    />
  )
})
