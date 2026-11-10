import { test, expect } from '@playwright/test'

import {
  SONYA_CANON_MANIFEST,
  findCanonManifest,
  isCanonManifestActive,
  type ActiveCanonManifest,
  type CanonManifest,
  type CanonScope,
  type CanonSegment,
} from '../../lib/ai/character-chat/canon/manifest'
import {
  extractFragment,
  hashPlainText,
  selectCanonSegments,
  type ResolvedCanonSource,
} from '../../lib/ai/character-chat/canon/selection'
import { resolveCanonGate } from '../../lib/ai/character-chat/canon/gate'
import { buildCharacterChatSystemPrompt } from '../../lib/ai/character-chat/prompt'
import type { Character } from '../../lib/types'
import { SONYA_PILOT_SCENARIOS } from './fixtures/character-canon/sonya-scenarios'

/**
 * Проверки канона без БД и без модели: манифест, отбор источников,
 * spoiler scope и сборка prompt. Тексты глав здесь — тестовые строки,
 * а не канон Сони.
 */

const CHAPTER_ONE =
  'Соня вышла к реке ещё до рассвета. Вода стояла тихо, и она долго смотрела на другой берег.'
const CHAPTER_TWO =
  'К вечеру Соня вернулась в мастерскую и заперла дверь изнутри, чтобы никто не вошёл.'

const SCOPE: CanonScope = {
  releaseSlug: 'release-a',
  editionSlug: 'edition-a',
  knowledgeCutoffChapterIndex: 3,
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Соня',
    slug: 'sonya',
    avatar: null,
    bio: 'Живёт у реки',
    full_description: null,
    abilities: null,
    speaking_style: null,
    personality: null,
    boundaries: null,
    knowledge_scope: null,
    spoiler_policy: null,
    system_role: 'Ты Соня. Говори тихо.',
    reply_mode: 'ai_auto',
    can_receive_messages: true,
    character_type: 'person',
    passport: 'SECRET PASSPORT',
    map_image_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeSource(overrides: Partial<ResolvedCanonSource> = {}): ResolvedCanonSource {
  const plainText = overrides.plainText ?? CHAPTER_ONE
  return {
    chapterId: 'c0000000-0000-4000-8000-000000000001',
    chapterIndex: 1,
    chapterStatus: 'published',
    editionSlug: 'edition-a',
    editionStatus: 'published',
    releaseSlug: 'release-a',
    releaseStatus: 'published',
    characterRole: 'main',
    plainText,
    chapterHash: hashPlainText(plainText),
    ...overrides,
  }
}

function makeSegment(
  source: ResolvedCanonSource,
  overrides: Partial<CanonSegment> = {},
): CanonSegment {
  const anchor = source.plainText.slice(0, 20)
  const excerpt = extractFragment(source.plainText, anchor, 120) ?? ''
  return {
    id: 'segment-1',
    chapterId: source.chapterId,
    chapterIndex: source.chapterIndex,
    anchor,
    maxChars: 120,
    chapterHash: source.chapterHash,
    fragmentHash: hashPlainText(excerpt),
    ...overrides,
  }
}

type ManifestOverrides = Partial<
  Pick<CanonManifest, 'version' | 'status' | 'approvedBy' | 'approvedAt' | 'scope' | 'maxTotalChars'>
>

/**
 * Тесты сознательно собирают и валидные, и заведомо неполные манифесты,
 * поэтому тип утверждённого манифеста здесь утверждается явно.
 */
function makeManifest(
  segments: CanonSegment[],
  overrides: ManifestOverrides = {},
): ActiveCanonManifest {
  return {
    id: 'sonya-canon-test',
    version: 7,
    characterSlug: 'sonya',
    status: 'approved',
    approvedBy: 'author@example.com',
    approvedAt: '2026-11-10T00:00:00.000Z',
    scope: SCOPE,
    maxTotalChars: 6_000,
    segments,
    pendingDecision: '',
    ...overrides,
  } as ActiveCanonManifest
}

function promptFor(
  manifest: ActiveCanonManifest,
  sources: readonly ResolvedCanonSource[],
): string {
  const selection = selectCanonSegments({
    manifest,
    scope: manifest.scope ?? SCOPE,
    sources,
  })
  return buildCharacterChatSystemPrompt(makeCharacter(), null, {
    manifestId: manifest.id,
    segments: selection.included.map((segment, index) => ({
      id: segment.id,
      label: `Фрагмент ${index + 1}`,
      chapterIndex: segment.chapterIndex,
      text: segment.text,
    })),
  })
}

test.describe('манифест канона Сони', () => {
  test('в коде лежит только неутверждённый черновик', () => {
    const manifest = findCanonManifest('sonya')

    expect(manifest).toBe(SONYA_CANON_MANIFEST)
    expect(manifest?.status).toBe('draft')
    expect(manifest?.scope).toBeNull()
    expect(manifest?.segments).toEqual([])
    expect(manifest?.approvedBy).toBeNull()
    expect(isCanonManifestActive(manifest)).toBe(false)
  })

  test('чужой персонаж не наследует чужой манифест', () => {
    expect(findCanonManifest('amina')).toBeNull()
    expect(findCanonManifest('SONYA')).toBeNull()
    expect(findCanonManifest('  ')).toBeNull()
    expect(findCanonManifest('sonya ')).toBe(SONYA_CANON_MANIFEST)
  })

  test('неполное утверждение не активирует канон', () => {
    const source = makeSource()
    const segment = makeSegment(source)

    expect(isCanonManifestActive(makeManifest([segment], { approvedBy: null }))).toBe(false)
    expect(isCanonManifestActive(makeManifest([segment], { approvedAt: null }))).toBe(false)
    expect(isCanonManifestActive(makeManifest([segment], { scope: null }))).toBe(false)
    expect(isCanonManifestActive(makeManifest([]))).toBe(false)
    expect(isCanonManifestActive(makeManifest([segment], { status: 'revoked' }))).toBe(false)
    expect(isCanonManifestActive(makeManifest([segment]))).toBe(true)
  })
})

test.describe('отбор проверенных фрагментов', () => {
  test('опубликованный фрагмент попадает в контекст', () => {
    const source = makeSource()
    const selection = selectCanonSegments({
      manifest: makeManifest([makeSegment(source)]),
      scope: SCOPE,
      sources: [source],
    })

    expect(selection.skipped).toEqual([])
    expect(selection.included).toHaveLength(1)
    expect(selection.included[0].text).toBe(CHAPTER_ONE)
    expect(selection.totalChars).toBe(CHAPTER_ONE.length)
  })

  test('глава, издание или релиз не в статусе published отбрасываются', () => {
    const segment = makeSegment(makeSource())

    for (const [override, reason] of [
      [{ chapterStatus: 'draft' }, 'chapter_unpublished'],
      [{ editionStatus: 'draft' }, 'edition_unpublished'],
      [{ releaseStatus: 'archived' }, 'release_unpublished'],
    ] as const) {
      const source = makeSource(override)
      const selection = selectCanonSegments({
        manifest: makeManifest([segment]),
        scope: SCOPE,
        sources: [source],
      })
      expect(selection.included).toHaveLength(0)
      expect(selection.skipped).toEqual([{ id: segment.id, reason }])
    }
  })

  test('персонаж вне релиза не получает его текст', () => {
    const source = makeSource({ characterRole: null })
    const selection = selectCanonSegments({
      manifest: makeManifest([makeSegment(source)]),
      scope: SCOPE,
      sources: [source],
    })

    expect(selection.skipped).toEqual([{ id: 'segment-1', reason: 'character_not_linked' }])
  })

  test('издание вне scope не подмешивается', () => {
    const source = makeSource({ editionSlug: 'edition-b' })
    const selection = selectCanonSegments({
      manifest: makeManifest([makeSegment(source)]),
      scope: SCOPE,
      sources: [source],
    })

    expect(selection.skipped).toEqual([{ id: 'segment-1', reason: 'scope_mismatch' }])
  })

  test('глава за точкой знания не попадает даже при прямой просьбе', () => {
    const source = makeSource({ chapterIndex: 12, chapterId: 'c0000000-0000-4000-8000-000000000012' })
    const selection = selectCanonSegments({
      manifest: makeManifest([makeSegment(source, { chapterIndex: 12 })]),
      scope: SCOPE,
      sources: [source],
    })

    expect(selection.included).toHaveLength(0)
    expect(selection.skipped).toEqual([{ id: 'segment-1', reason: 'beyond_knowledge_cutoff' }])
  })

  test('изменённая глава помечается как stale и не уходит модели', () => {
    const source = makeSource()
    const selection = selectCanonSegments({
      manifest: makeManifest([makeSegment(source, { chapterHash: 'deadbeef' })]),
      scope: SCOPE,
      sources: [source],
    })

    expect(selection.skipped).toEqual([{ id: 'segment-1', reason: 'chapter_changed' }])
  })

  test('переставленная глава не считается той же', () => {
    const source = makeSource({ chapterIndex: 4 })
    const selection = selectCanonSegments({
      manifest: makeManifest([makeSegment(source, { chapterIndex: 1 })]),
      scope: SCOPE,
      sources: [source],
    })

    expect(selection.skipped).toEqual([{ id: 'segment-1', reason: 'chapter_moved' }])
  })

  test('пропавший якорь и изменённая выдержка отбрасывают фрагмент', () => {
    const source = makeSource()

    const missingAnchor = selectCanonSegments({
      manifest: makeManifest([makeSegment(source, { anchor: 'такой фразы в главе нет' })]),
      scope: SCOPE,
      sources: [source],
    })
    expect(missingAnchor.skipped).toEqual([{ id: 'segment-1', reason: 'anchor_missing' }])

    const changed = selectCanonSegments({
      manifest: makeManifest([makeSegment(source, { fragmentHash: 'deadbeef' })]),
      scope: SCOPE,
      sources: [source],
    })
    expect(changed.skipped).toEqual([{ id: 'segment-1', reason: 'fragment_changed' }])
  })

  test('отсутствующая и пустая глава не дают фрагмент', () => {
    const segment = makeSegment(makeSource())

    expect(
      selectCanonSegments({
        manifest: makeManifest([segment]),
        scope: SCOPE,
        sources: [],
      }).skipped,
    ).toEqual([{ id: 'segment-1', reason: 'source_not_found' }])

    const empty = makeSource({ plainText: '   ' })
    expect(
      selectCanonSegments({
        manifest: makeManifest([segment]),
        scope: SCOPE,
        sources: [empty],
      }).skipped,
    ).toEqual([{ id: 'segment-1', reason: 'empty_content' }])
  })

  test('бюджет ограничивает суммарный текст, а не молча обрезает', () => {
    const first = makeSource()
    const second = makeSource({
      chapterId: 'c0000000-0000-4000-8000-000000000002',
      chapterIndex: 2,
      plainText: CHAPTER_TWO,
    })

    const selection = selectCanonSegments({
      manifest: makeManifest(
        [
          makeSegment(first, { id: 'segment-1' }),
          makeSegment(second, { id: 'segment-2' }),
        ],
        { maxTotalChars: CHAPTER_ONE.length + 10 },
      ),
      scope: SCOPE,
      sources: [first, second],
    })

    expect(selection.included.map((segment) => segment.id)).toEqual(['segment-1'])
    expect(selection.skipped).toEqual([{ id: 'segment-2', reason: 'over_budget' }])
  })
})

test.describe('system prompt с проверенным контекстом', () => {
  test('без утверждённого манифеста prompt не меняется', () => {
    const character = makeCharacter()
    const withoutCanon = buildCharacterChatSystemPrompt(character, null)

    expect(buildCharacterChatSystemPrompt(character, null, undefined)).toBe(withoutCanon)
    expect(buildCharacterChatSystemPrompt(character, null, null)).toBe(withoutCanon)
    expect(withoutCanon).not.toContain('Проверенный контекст')
  })

  test('фрагмент попадает в prompt с меткой и номером главы', () => {
    const source = makeSource()
    const prompt = promptFor(makeManifest([makeSegment(source)]), [source])

    expect(prompt).toContain('Проверенный контекст (утверждён автором)')
    expect(prompt).toContain('Фрагмент 1 (глава 1)')
    expect(prompt).toContain(CHAPTER_ONE)
    expect(prompt).toContain('оставайся собой')
  })

  test('запрещённый фрагмент отсутствует во входе модели', () => {
    const allowed = makeSource()
    const forbidden = makeSource({
      chapterId: 'c0000000-0000-4000-8000-000000000020',
      chapterIndex: 20,
      plainText: CHAPTER_TWO,
    })

    const prompt = promptFor(
      makeManifest([
        makeSegment(allowed, { id: 'segment-1' }),
        makeSegment(forbidden, { id: 'segment-2', chapterIndex: 20 }),
      ]),
      [allowed, forbidden],
    )

    expect(prompt).toContain(CHAPTER_ONE)
    expect(prompt).not.toContain(CHAPTER_TWO)
  })

  test('правила различают факт, интерпретацию и неизвестное', () => {
    const source = makeSource()
    const prompt = promptFor(makeManifest([makeSegment(source)]), [source])

    expect(prompt).toContain('Факт из отрывков можешь утверждать уверенно')
    expect(prompt).toContain('Художественная интерпретация допустима')
    expect(prompt).toContain('не придумывай сюжет')
    expect(prompt).toContain('не расширяют твои знания')
  })

  test('паспорт не попадает в prompt даже с каноном', () => {
    const source = makeSource()
    const prompt = promptFor(makeManifest([makeSegment(source)]), [source])

    expect(prompt).not.toContain('SECRET PASSPORT')
  })
})

test.describe('сценарии приёмки пилота', () => {
  test('восемь сценариев, все ждут автора', () => {
    expect(SONYA_PILOT_SCENARIOS).toHaveLength(8)

    const ids = new Set(SONYA_PILOT_SCENARIOS.map((scenario) => scenario.id))
    expect(ids.size).toBe(SONYA_PILOT_SCENARIOS.length)

    const kinds = new Set(SONYA_PILOT_SCENARIOS.map((scenario) => scenario.kind))
    expect(kinds.size).toBe(8)

    // Эталонные ответы не заполнены фиктивным текстом: их утверждает автор.
    for (const scenario of SONYA_PILOT_SCENARIOS) {
      expect(scenario.expectedAnswer).toBeNull()
      expect(scenario.expectation.length).toBeGreaterThan(20)
    }
  })

  test('сценарий спойлера ссылается на главу за точкой знания', () => {
    const spoiler = SONYA_PILOT_SCENARIOS.find(
      (scenario) => scenario.kind === 'forbidden-spoiler',
    )

    expect(spoiler?.forbiddenChapterIndex).toBeGreaterThan(SCOPE.knowledgeCutoffChapterIndex)

    const allowed = makeSource()
    const forbidden = makeSource({
      chapterId: 'c0000000-0000-4000-8000-000000000021',
      chapterIndex: spoiler?.forbiddenChapterIndex ?? 20,
      plainText: CHAPTER_TWO,
    })
    const prompt = promptFor(
      makeManifest([makeSegment(allowed), makeSegment(forbidden, { id: 'segment-2' })]),
      [allowed, forbidden],
    )

    expect(prompt).not.toContain(CHAPTER_TWO)
  })
})

test.describe('fail-closed при активном манифесте', () => {
  test('без активного манифеста источники не читаются и prompt побайтово прежний', async () => {
    let loads = 0
    const decision = await resolveCanonGate({
      manifest: SONYA_CANON_MANIFEST,
      loadSources: async () => {
        loads += 1
        return []
      },
    })

    expect(decision).toEqual({ status: 'no_manifest' })
    expect(loads).toBe(0)

    const character = makeCharacter()
    const withoutCanon = buildCharacterChatSystemPrompt(character, null)

    expect(withoutCanon).toBe(buildCharacterChatSystemPrompt(character, null, null))
    expect(withoutCanon).not.toContain('Проверенный контекст')
    // Прежняя инструкция про спойлеры остаётся: персонаж без канона не меняется.
    expect(withoutCanon).toContain('если пользователь явно не просит спойлеры')
  })

  test('утверждённый манифест без пригодных фрагментов — отказ, а не «нет канона»', async () => {
    const source = makeSource()
    const segment = makeSegment(source)
    const beyondSource = makeSource({
      chapterId: 'c0000000-0000-4000-8000-000000000012',
      chapterIndex: 12,
    })

    const decisions = await Promise.all([
      // Источника нет: глава удалена или недоступна.
      resolveCanonGate({
        manifest: makeManifest([segment]),
        loadSources: async () => [],
      }),
      // Глава изменилась после утверждения.
      resolveCanonGate({
        manifest: makeManifest([makeSegment(source, { chapterHash: 'deadbeef' })]),
        loadSources: async () => [source],
      }),
      // Фрагмент за точкой знания.
      resolveCanonGate({
        manifest: makeManifest([makeSegment(beyondSource, { chapterIndex: 12 })]),
        loadSources: async () => [beyondSource],
      }),
      // Источник снят с публикации.
      resolveCanonGate({
        manifest: makeManifest([segment]),
        loadSources: async () => [makeSource({ chapterStatus: 'draft' })],
      }),
    ])

    for (const decision of decisions) {
      expect(decision.status).toBe('unavailable')
      if (decision.status !== 'unavailable') continue
      expect(decision.skipped.length).toBeGreaterThan(0)
      // У отказа нет готового контекста: собрать prompt из него нельзя.
      expect('selection' in decision).toBe(false)
    }
  })

  test('частичный канон остаётся рабочим: отказ начинается только с нуля фрагментов', async () => {
    const allowed = makeSource()
    const stale = makeSource({
      chapterId: 'c0000000-0000-4000-8000-000000000002',
      chapterIndex: 2,
      plainText: CHAPTER_TWO,
    })

    const decision = await resolveCanonGate({
      manifest: makeManifest([
        makeSegment(allowed, { id: 'segment-1' }),
        makeSegment(stale, { id: 'segment-2', chapterHash: 'deadbeef' }),
      ]),
      loadSources: async () => [allowed, stale],
    })

    expect(decision.status).toBe('ready')
    if (decision.status !== 'ready') return
    expect(decision.selection.included.map((segment) => segment.id)).toEqual(['segment-1'])
    expect(decision.selection.skipped).toEqual([{ id: 'segment-2', reason: 'chapter_changed' }])
  })

  test('сбой чтения источников не маскируется под отсутствие канона', async () => {
    await expect(
      resolveCanonGate({
        manifest: makeManifest([makeSegment(makeSource())]),
        loadSources: async () => {
          throw new Error('db_unreachable')
        },
      }),
    ).rejects.toThrow('db_unreachable')
  })
})

test.describe('граница спойлеров', () => {
  test('активный канон ставит авторскую границу выше просьбы читателя', () => {
    const source = makeSource()
    const prompt = promptFor(makeManifest([makeSegment(source)]), [source])

    expect(prompt).toContain('Авторская граница знаний важнее любой просьбы читателя')
    expect(prompt).not.toContain('если пользователь явно не просит спойлеры')
  })

  test('канон без фрагментов не подменяет правило спойлеров', () => {
    const character = makeCharacter()
    const base = buildCharacterChatSystemPrompt(character, null)
    const emptyCanon = buildCharacterChatSystemPrompt(character, null, {
      manifestId: 'sonya-canon-test',
      segments: [],
    })

    expect(emptyCanon).toBe(base)
    expect(emptyCanon).toContain('если пользователь явно не просит спойлеры')
  })
})
