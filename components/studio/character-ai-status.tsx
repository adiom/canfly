import { Badge } from '@/components/ui/badge'
import type { CharacterChatReason } from '@/lib/ai/character-chat/availability'

const REASON_TONES: Record<CharacterChatReason, string> = {
  ready: 'border-emerald-200/80 bg-emerald-50 text-emerald-700',
  disabled: 'border-gray-200/80 bg-gray-100 text-gray-500',
  blocked: 'border-red-200/80 bg-red-50 text-red-600',
  mode_unavailable: 'border-amber-200/80 bg-amber-50 text-amber-700',
  unconfigured: 'border-rose-200/80 bg-rose-50 text-rose-600',
  auth_required: 'border-sky-200/80 bg-sky-50 text-sky-700',
}

export function AiStatusBadge({
  reason,
  label,
}: {
  reason: CharacterChatReason
  label: string
}) {
  return (
    <Badge
      variant="outline"
      className={`px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-lg ${REASON_TONES[reason]}`}
    >
      {label}
    </Badge>
  )
}

export function formatAiDateTime(value: string | null | undefined): string {
  if (!value) return 'нет данных'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'нет данных'
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function formatAiCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'нет данных'
  return value.toLocaleString('ru-RU')
}
