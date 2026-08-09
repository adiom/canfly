import type { Character } from '@/lib/types'

type PresenceTone = 'on' | 'slow' | 'quiet'

export interface Presence {
  tone: PresenceTone
  label: string
}

/**
 * Сигнал живого героя. Читается из реального режима ответов, а не из выдуманного
 * «онлайн»: молчащий персонаж не должен обещать разговор.
 */
export function presenceOf(
  character: Pick<Character, 'reply_mode' | 'can_receive_messages'>,
): Presence {
  if (character.can_receive_messages === false || character.reply_mode === 'disabled') {
    return { tone: 'quiet', label: 'молчит' }
  }
  if (character.reply_mode === 'ai_auto') {
    return { tone: 'on', label: 'отвечает сам' }
  }
  return { tone: 'slow', label: 'отвечает не всегда' }
}

const TONE_CLASS: Record<PresenceTone, string> = {
  on: 'text-cf-live-on',
  slow: 'text-cf-live-slow',
  quiet: 'text-cf-live-quiet',
}

const DOT_CLASS: Record<PresenceTone, string> = {
  on: 'bg-cf-live-on cf-live-pulse',
  slow: 'bg-cf-live-slow',
  quiet: 'bg-cf-live-quiet',
}

interface CharacterPresenceProps {
  character: Pick<Character, 'reply_mode' | 'can_receive_messages'>
  className?: string
}

export function CharacterPresence({ character, className = '' }: CharacterPresenceProps) {
  const { tone, label } = presenceOf(character)

  return (
    <span className={`inline-flex items-center gap-2 ${TONE_CLASS[tone]} ${className}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[tone]}`} aria-hidden />
      <span className="text-[10px] font-medium uppercase tracking-[0.2em]">{label}</span>
    </span>
  )
}
