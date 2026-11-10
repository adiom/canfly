import { dbQuery } from '@/lib/db'
import { chapterPlainText } from '@/lib/server/highlight-source'
import { findCanonManifest } from '@/lib/ai/character-chat/canon/manifest'
import { resolveCanonGate } from '@/lib/ai/character-chat/canon/gate'
import {
  hashPlainText,
  type ResolvedCanonSource,
  type SkippedCanonSegment,
} from '@/lib/ai/character-chat/canon/selection'
import type { CharacterCanonPrompt } from '@/lib/ai/character-chat/prompt'

/**
 * Проверенный контекст персонажа для одного хода чата.
 *
 * Механизм намеренно маленький и без миграций: манифест лежит в коде
 * (`lib/ai/character-chat/canon/manifest.ts`), а сюда попадает только то, что
 * реально существует в БД как опубликованный источник и совпадает с
 * утверждённым хешем. Никакой записи здесь нет: чат не может изменить канон.
 */

export interface CharacterCanonMetadata {
  manifestId: string
  manifestVersion: number
  /** sha256 отобранного текста: по нему видно, какой контекст ушёл в модель. */
  contentHash: string
  /** Только идентификаторы фрагментов и глав, без текста. */
  segments: Array<{ id: string; chapterId: string; chapterIndex: number; fragmentHash: string }>
  skipped: Array<{ id: string; reason: SkippedCanonSegment['reason'] }>
  totalChars: number
}

export interface CharacterCanonContext {
  prompt: CharacterCanonPrompt
  metadata: CharacterCanonMetadata
}

/**
 * Результат разрешения канона для хода.
 *
 * `none` и `unavailable` — не одно и то же: в первом случае у персонажа нет
 * утверждённого манифеста и чат работает как раньше, во втором манифест
 * активен, но источников нет, поэтому ответ запрещён (fail-closed).
 */
export type CharacterCanonResolution =
  | { kind: 'none' }
  | { kind: 'ready'; context: CharacterCanonContext }
  | {
      kind: 'unavailable'
      manifestId: string
      manifestVersion: number
      skipped: SkippedCanonSegment[]
    }

type CanonSourceRow = {
  chapter_id: string
  chapter_index: number
  chapter_status: string
  content: string | null
  edition_slug: string
  edition_status: string
  release_slug: string
  release_status: string
  character_role: string | null
}

async function fetchCanonSources(
  chapterIds: readonly string[],
  characterId: string,
): Promise<ResolvedCanonSource[]> {
  if (chapterIds.length === 0) return []

  const rows = await dbQuery<CanonSourceRow>(
    `SELECT ch.id AS chapter_id,
       ch.chapter_index,
       ch.status::text AS chapter_status,
       ch.content,
       e.slug AS edition_slug,
       e.status::text AS edition_status,
       r.slug AS release_slug,
       r.status::text AS release_status,
       rc.role::text AS character_role
     FROM chapters ch
     JOIN editions e ON e.id = ch.edition_id
     JOIN releases r ON r.id = e.release_id
     LEFT JOIN release_characters rc
       ON rc.release_id = r.id AND rc.character_id = $2
     WHERE ch.id = ANY($1::uuid[])`,
    [[...chapterIds], characterId],
  )

  return rows.map((row) => {
    const plainText = row.content ? chapterPlainText(row.content) : ''
    return {
      chapterId: row.chapter_id,
      chapterIndex: row.chapter_index,
      chapterStatus: row.chapter_status,
      editionSlug: row.edition_slug,
      editionStatus: row.edition_status,
      releaseSlug: row.release_slug,
      releaseStatus: row.release_status,
      characterRole: row.character_role,
      plainText,
      chapterHash: plainText ? hashPlainText(plainText) : '',
    }
  })
}

/**
 * Разрешает канон персонажа на один ход.
 *
 * Без активного манифеста возвращает `none` — прежнее поведение чата.
 * С активным манифестом и хотя бы одним проверенным фрагментом — `ready`.
 * С активным манифестом и нулём пригодных фрагментов — `unavailable`:
 * вызывающий слой обязан отказать, а не подменять канон ответом без источников.
 * Ошибка чтения БД пробрасывается: это тоже отказ, а не «нет канона».
 */
export async function resolveCharacterCanon(input: {
  characterId: string
  characterSlug: string
}): Promise<CharacterCanonResolution> {
  const decision = await resolveCanonGate({
    manifest: findCanonManifest(input.characterSlug),
    loadSources: (chapterIds) => fetchCanonSources(chapterIds, input.characterId),
  })

  if (decision.status === 'no_manifest') return { kind: 'none' }

  if (decision.status === 'unavailable') {
    return {
      kind: 'unavailable',
      manifestId: decision.manifest.id,
      manifestVersion: decision.manifest.version,
      skipped: decision.skipped,
    }
  }

  const { manifest, selection } = decision
  const contentHash = hashPlainText(
    selection.included
      .map((segment) => `${segment.id}:${segment.fragmentHash}:${segment.text}`)
      .join('\n\n'),
  )

  return {
    kind: 'ready',
    context: {
      prompt: {
        manifestId: manifest.id,
        segments: selection.included.map((segment, index) => ({
          id: segment.id,
          label: `Фрагмент ${index + 1}`,
          chapterIndex: segment.chapterIndex,
          text: segment.text,
        })),
      },
      metadata: {
        manifestId: manifest.id,
        manifestVersion: manifest.version,
        contentHash,
        segments: selection.included.map((segment) => ({
          id: segment.id,
          chapterId: segment.chapterId,
          chapterIndex: segment.chapterIndex,
          fragmentHash: segment.fragmentHash,
        })),
        skipped: selection.skipped,
        totalChars: selection.totalChars,
      },
    },
  }
}
