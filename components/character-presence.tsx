import type { Character, CharacterFriendshipStatus } from '@/lib/types'
import { resolveCharacterChatAvailability } from '@/lib/ai/character-chat/availability'

type PresenceTone = 'on' | 'slow' | 'quiet'

export interface Presence {
  tone: PresenceTone
  label: string
}

export interface PresenceOptions {
  /** `blocked` превращает «отвечает» в «не отвечает». */
  friendshipStatus?: CharacterFriendshipStatus | null
  /** Передавайте `false`, только когда достоверно известно, что гость не вошёл. */
  authenticated?: boolean
}

/**
 * Сигнал живого героя. Читается из того же резолвера, что и API: молчащий
 * персонаж не должен обещать разговор, а ручной режим — «скорый ответ».
 */
export function presenceOf(
  character: Pick<Character, 'reply_mode' | 'can_receive_messages' | 'system_role'>,
  options: PresenceOptions = {},
): Presence {
  const availability = resolveCharacterChatAvailability({ character, ...options })

  const tone: PresenceTone = availability.canGenerate
    ? 'on'
    : availability.reason === 'auth_required'
      ? 'slow'
      : 'quiet'

  return { tone, label: availability.label }
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

interface CharacterPresenceProps extends PresenceOptions {
  character: Pick<Character, 'reply_mode' | 'can_receive_messages' | 'system_role'>
  className?: string
}

export function CharacterPresence({
  character,
  friendshipStatus,
  authenticated,
  className = '',
}: CharacterPresenceProps) {
  const { tone, label } = presenceOf(character, { friendshipStatus, authenticated })

  return (
    <span className={`inline-flex items-center gap-2 ${TONE_CLASS[tone]} ${className}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[tone]}`} aria-hidden />
      <span className="text-[10px] font-medium uppercase tracking-[0.2em]">{label}</span>
    </span>
  )
}
