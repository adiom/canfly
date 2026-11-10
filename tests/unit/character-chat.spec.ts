import { test, expect } from '@playwright/test'

import {
  resolveCharacterChatAvailability,
} from '../../lib/ai/character-chat/availability'
import {
  buildModelContext,
  extractLatestUserMessage,
  normalizeChatText,
} from '../../lib/ai/character-chat/turn'
import { buildCharacterChatSystemPrompt } from '../../lib/ai/character-chat/prompt'
import type { Character } from '../../lib/types'

const readyCharacter = {
  can_receive_messages: true,
  reply_mode: 'ai_auto' as const,
  system_role: 'Ты Соня. Говори тихо.',
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Соня Крой',
    slug: 'sonya-kroy',
    avatar: null,
    bio: 'Живёт у реки',
    full_description: null,
    abilities: null,
    speaking_style: 'тихо',
    personality: 'замкнутая',
    boundaries: 'не говорит о прошлом',
    knowledge_scope: 'только город',
    spoiler_policy: 'без спойлеров',
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

test.describe('доступность чата персонажа', () => {
  test('ai_auto с system_role отвечает', () => {
    const availability = resolveCharacterChatAvailability({ character: readyCharacter })
    expect(availability).toMatchObject({ canGenerate: true, reason: 'ready' })
  })

  test('disabled и can_receive_messages=false молчат', () => {
    expect(
      resolveCharacterChatAvailability({
        character: { ...readyCharacter, reply_mode: 'disabled' },
      }).reason,
    ).toBe('disabled')

    expect(
      resolveCharacterChatAvailability({
        character: { ...readyCharacter, can_receive_messages: false },
      }).reason,
    ).toBe('disabled')
  })

  test('blocked перекрывает режим и запрещает генерацию', () => {
    const availability = resolveCharacterChatAvailability({
      character: { ...readyCharacter, reply_mode: 'manual' },
      friendshipStatus: 'blocked',
    })
    expect(availability.canGenerate).toBe(false)
    expect(availability.reason).toBe('blocked')
  })

  test('manual и hybrid не запускаются автоматически и не подменяются', () => {
    for (const reply_mode of ['manual', 'hybrid'] as const) {
      const availability = resolveCharacterChatAvailability({
        character: { ...readyCharacter, reply_mode },
      })
      expect(availability.canGenerate).toBe(false)
      expect(availability.reason).toBe('mode_unavailable')
    }
  })

  test('пустой system_role — речь не настроена', () => {
    const availability = resolveCharacterChatAvailability({
      character: { ...readyCharacter, system_role: '   ' },
    })
    expect(availability.canGenerate).toBe(false)
    expect(availability.reason).toBe('unconfigured')
  })

  test('гость получает auth_required, а блокировка важнее входа', () => {
    expect(
      resolveCharacterChatAvailability({ character: readyCharacter, authenticated: false }).reason,
    ).toBe('auth_required')

    expect(
      resolveCharacterChatAvailability({
        character: readyCharacter,
        friendshipStatus: 'blocked',
        authenticated: false,
      }).reason,
    ).toBe('blocked')
  })
})

test.describe('текст хода', () => {
  test('normalizeChatText убирает NUL и крайние пробелы', () => {
    expect(normalizeChatText('\u0000 привет \u0000')).toBe('привет')
    expect(normalizeChatText('   ')).toBe('')
  })

  test('из устаревшего payload берётся последняя реплика пользователя', () => {
    expect(
      extractLatestUserMessage([
        { role: 'user', content: 'первая' },
        { role: 'assistant', content: 'ответ' },
        { role: 'user', content: '  вторая  ' },
      ]),
    ).toBe('вторая')

    expect(
      extractLatestUserMessage([
        { role: 'user', content: 'первая' },
        { role: 'assistant', content: 'ответ' },
      ]),
    ).toBe('первая')

    expect(extractLatestUserMessage([{ role: 'user', content: 42 }])).toBeNull()
    expect(extractLatestUserMessage('нет')).toBeNull()
  })

  test('контекст ограничен по символам, но самая свежая реплика остаётся', () => {
    const messages = [
      { role: 'user' as const, content: 'старое длинное сообщение' },
      { role: 'character' as const, content: 'старый ответ' },
      { role: 'user' as const, content: 'новое' },
    ]

    const context = buildModelContext(messages, 5)

    expect(context).toEqual([{ role: 'user', content: 'новое' }])
    expect(buildModelContext(messages, 100)).toHaveLength(3)
    expect(buildModelContext(messages, 100)[1]).toEqual({
      role: 'assistant',
      content: 'старый ответ',
    })

    // Служебные system-записи из БД не попадают в диалог модели.
    expect(
      buildModelContext(
        [
          { role: 'system' as const, content: 'служебное' },
          { role: 'user' as const, content: 'привет' },
        ],
        100,
      ),
    ).toEqual([{ role: 'user', content: 'привет' }])
  })
})

test.describe('system prompt', () => {
  test('собирается из авторских полей и не содержит паспорт', () => {
    const prompt = buildCharacterChatSystemPrompt(makeCharacter(), null)

    expect(prompt).toContain('Ты Соня')
    expect(prompt).toContain('Соня Крой')
    expect(prompt).toContain('Границы знаний')
    expect(prompt).not.toContain('SECRET PASSPORT')
    expect(prompt).toContain('ещё не добавлял тебя в друзья')
  })

  test('дружба добавляет реальный статус и близость', () => {
    const prompt = buildCharacterChatSystemPrompt(makeCharacter(), {
      status: 'accepted',
      intimacy_level: 42,
    })

    expect(prompt).toContain('accepted')
    expect(prompt).toContain('42/100')
  })
})
