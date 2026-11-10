import type { PublicRole } from '@/lib/types'

/**
 * Права на AI-панель Studio.
 *
 * Просмотр агрегатов разрешён автору и администратору — это те же роли,
 * которые видят раздел «Персонажи». Редактирование технических настроек
 * доступно только администратору: именно это право уже требуется
 * `updateCharacterAction` и v2-редактору. Отдельного владения персонажем в
 * схеме нет, поэтому связь с релизом не выдаёт право на общего героя.
 *
 * Тексты чужих переписок эти функции не открывают: панель показывает только
 * агрегаты и коды ошибок, без `character_messages.content`.
 */
export interface CharacterAiActor {
  isAdmin: boolean
  publicRole: PublicRole
}

export function canViewCharacterAi(actor: CharacterAiActor | null | undefined): boolean {
  if (!actor) return false
  return actor.isAdmin || actor.publicRole === 'author'
}

export function canManageCharacterAi(actor: CharacterAiActor | null | undefined): boolean {
  return !!actor?.isAdmin
}
