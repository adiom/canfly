import type { Character, CharacterFriendshipStatus } from '@/lib/types'

/**
 * Одно место, откуда страница, API и карточки узнают, может ли персонаж
 * ответить. Причина возвращается явно, чтобы UI не обещал разговор, а API
 * не запускал платный вызов.
 *
 * `manual`/`hybrid` здесь осознанно не считаются готовыми: настоящего
 * workflow подтверждения автором нет, поэтому автоматическая генерация
 * запрещена. Режим при этом не подменяется на `ai_auto`.
 */
export type CharacterChatReason =
  | 'ready'
  | 'disabled'
  | 'blocked'
  | 'mode_unavailable'
  | 'unconfigured'
  | 'auth_required'

export interface CharacterChatAvailability {
  canGenerate: boolean
  reason: CharacterChatReason
  /** Короткая подпись для карточек. */
  label: string
}

export interface CharacterChatAvailabilityInput {
  character: Pick<Character, 'can_receive_messages' | 'reply_mode' | 'system_role'>
  /** `null` — связи ещё нет; это не блокирует чат. */
  friendshipStatus?: CharacterFriendshipStatus | null
  /** Передавайте `false` только когда достоверно известно, что гость не вошёл. */
  authenticated?: boolean
}

const LABELS: Record<CharacterChatReason, string> = {
  ready: 'отвечает сам',
  disabled: 'молчит',
  blocked: 'не отвечает',
  mode_unavailable: 'не отвечает сам',
  unconfigured: 'речь ещё не настроена',
  auth_required: 'нужно войти',
}

/**
 * Пояснения для Studio. Тот же резолвер обслуживает страницу чата, карточки и
 * API, поэтому авторская панель не может показать «готов» там, где runtime
 * откажет.
 */
export const CHARACTER_CHAT_REASON_HINTS: Record<CharacterChatReason, string> = {
  ready: 'Режим ai_auto, инструкция заполнена, генерация разрешена.',
  disabled:
    'Персонаж выключен: can_receive_messages=false или reply_mode=disabled. Платная генерация не запускается.',
  blocked:
    'Читателю закрыт ответ: связь в статусе blocked. Это проверяется до записи хода и оплаты.',
  mode_unavailable:
    'Режим manual/hybrid не запускает автоматическую генерацию: очереди подтверждения автором в Canfly нет.',
  unconfigured:
    'Поле system_role пустое. Инструкция редактируется в карточке персонажа, здесь она не дублируется.',
  auth_required: 'Гость не может отправить вопрос: нужен вход в аккаунт.',
}

export function resolveCharacterChatAvailability({
  character,
  friendshipStatus = null,
  authenticated,
}: CharacterChatAvailabilityInput): CharacterChatAvailability {
  const order: CharacterChatReason[] = []
  if (character.can_receive_messages === false || character.reply_mode === 'disabled') {
    order.push('disabled')
  }
  if (friendshipStatus === 'blocked') {
    order.push('blocked')
  }
  if (character.reply_mode === 'manual' || character.reply_mode === 'hybrid') {
    order.push('mode_unavailable')
  }
  if (!character.system_role?.trim()) {
    order.push('unconfigured')
  }
  if (authenticated === false) {
    order.push('auth_required')
  }

  const reason = order[0] ?? 'ready'
  return {
    canGenerate: reason === 'ready',
    reason,
    label: LABELS[reason],
  }
}

/** Есть ли у персонажа вообще автоматический режим ответа (для карточек). */
export function isAutoReplyMode(character: Pick<Character, 'reply_mode'>): boolean {
  return character.reply_mode === 'ai_auto'
}
