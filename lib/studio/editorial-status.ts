/**
 * Единая карта визуала статусов редакторских правок.
 *
 * До этого тройка цветов дублировалась в трёх местах (панель, оверлей,
 * редактор главы) хардкодом hex. Цвета живут в `app/globals.css`
 * (`--cf-status-*`), здесь — только их применение.
 */

import type { EditorialNoteStatus } from '@/lib/releases-types'

type StatusStyle = {
  /** Подпись для UI. */
  label: string
  /** Значение для inline `style` — там, где цвет нужен вне Tailwind (оверлей). */
  color: string
  /** Классы карточки правки в панели. */
  card: string
  /** Классы счётчика/бейджа. */
  badge: string
}

export const EDITORIAL_STATUS: Record<EditorialNoteStatus, StatusStyle> = {
  open: {
    label: 'В работе',
    color: 'var(--cf-status-open)',
    card: 'border-cf-status-open/40 bg-cf-status-open/10 hover:border-cf-status-open/70',
    badge: 'bg-cf-status-open/20 text-cf-status-open',
  },
  resolved: {
    label: 'Решена',
    color: 'var(--cf-status-resolved)',
    card: 'border-cf-status-resolved/40 bg-cf-status-resolved/10 opacity-60 hover:opacity-90',
    badge: 'bg-cf-status-resolved/20 text-cf-status-resolved',
  },
  ignored: {
    label: 'Отклонена',
    color: 'var(--cf-status-ignored)',
    card: 'border-cf-text-1/15 bg-cf-bg-2 opacity-50 hover:opacity-80',
    badge: 'bg-cf-text-1/10 text-cf-text-3',
  },
}

/** Приводит строку из БД к известному статусу; неизвестное считаем открытым. */
export function editorialStatusStyle(status: string): StatusStyle {
  return EDITORIAL_STATUS[status as EditorialNoteStatus] ?? EDITORIAL_STATUS.open
}
