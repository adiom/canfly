import type { Character } from '@/lib/types'

/**
 * Life-state секции «дела» персонажа — словарь состояний orbital:
 *   quiet   — пусто
 *   born    — едва начато
 *   alive   — заполнено
 *   settled — заполнено и есть история (версии паспорта и т. п.)
 *
 * Состояние считается из реальных данных персонажа; на нём держится весь
 * «прогресс оживания дела» в v2-редакторе (точки узлов и density bar).
 */
export type LifeState = 'quiet' | 'born' | 'alive' | 'settled'

export type SectionKey =
  | 'face'
  | 'voice'
  | 'conduct'
  | 'abilities'
  | 'passport'
  | 'relations'
  | 'posts'
  | 'wall'
  | 'readers'

export interface CharacterCompleteness {
  sections: Record<SectionKey, LifeState>
  /** 0..1 — доля «живых» (alive/settled) секций. */
  density: number
  /** Сводное состояние дела — по плотности. */
  summary: LifeState
}

function textState(value: string | null | undefined): LifeState {
  if (!value || !value.trim()) return 'quiet'
  // «Едва начато» — короткая заметка, «живо» — развёрнутое описание.
  return value.trim().length >= 40 ? 'alive' : 'born'
}

function countState(count: number): LifeState {
  if (count <= 0) return 'quiet'
  return count >= 3 ? 'alive' : 'born'
}

interface CompletenessInput {
  relationsCount: number
  postsCount: number
  wallCount: number
  readersCount: number
  /** Есть ли хотя бы одна версия паспорта в character_passport_versions. */
  passportHasHistory: boolean
}

/**
 * Считает life-state по всем секциям дела. Группы полей соответствуют узлам
 * v2-редактора. Все персонажи — люди (города живут отдельно, в таблице places).
 */
export function computeCharacterCompleteness(
  character: Character,
  input: CompletenessInput,
): CharacterCompleteness {
  const faceFields = [
    textState(character.bio),
    textState(character.full_description),
    'alive', // name+slug всегда есть
    character.avatar ? 'alive' : 'born',
  ]
  const faceAlive = faceFields.filter((s) => s === 'alive').length
  const face: LifeState =
    faceAlive >= 2 ? 'alive' : faceFields.some((s) => s !== 'quiet') ? 'born' : 'quiet'

  const voiceFields = [
    textState(character.personality),
    textState(character.speaking_style),
    textState(character.system_role),
  ]
  const voiceAlive = voiceFields.filter((s) => s === 'alive').length
  const voice: LifeState =
    voiceAlive >= 2 ? 'alive' : voiceFields.some((s) => s !== 'quiet') ? 'born' : 'quiet'

  const conductFields = [
    textState(character.boundaries),
    textState(character.knowledge_scope),
    textState(character.spoiler_policy),
  ]
  const conductAlive = conductFields.filter((s) => s === 'alive').length
  const conduct: LifeState =
    conductAlive >= 2
      ? 'alive'
      : conductFields.some((s) => s !== 'quiet')
        ? 'born'
        : 'quiet'

  const abilities: LifeState =
    character.abilities && character.abilities.length > 0 ? 'alive' : 'quiet'

  const passportBase: LifeState = textState(character.passport)
  const passport: LifeState =
    passportBase === 'alive' && input.passportHasHistory
      ? 'settled'
      : passportBase

  const sections: Record<SectionKey, LifeState> = {
    face,
    voice,
    conduct,
    abilities,
    passport,
    relations: countState(input.relationsCount),
    posts: countState(input.postsCount),
    wall: countState(input.wallCount),
    readers: countState(input.readersCount),
  }

  const all: SectionKey[] = [
    'face',
    'voice',
    'conduct',
    'abilities',
    'passport',
    'relations',
    'posts',
    'wall',
    'readers',
  ]
  const liveCount = all.filter((k) => sections[k] === 'alive' || sections[k] === 'settled').length
  const density = liveCount / all.length
  const summary: LifeState =
    density >= 0.66 ? 'alive' : density >= 0.33 ? 'born' : density > 0 ? 'born' : 'quiet'

  return { sections, density, summary }
}
