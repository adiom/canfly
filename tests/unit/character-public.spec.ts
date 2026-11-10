import { test, expect } from '@playwright/test'

import {
  normalizeAbilities,
  toPublicCharacter,
  toPublicConversationMessages,
} from '../../lib/character-public'
import type { Character, CharacterMessage } from '../../lib/types'

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Соня Крой',
    slug: 'sonya-kroy',
    avatar: '/avatar.png',
    bio: 'Короткое описание',
    full_description: 'Полное описание',
    abilities: ['видеть сны'],
    speaking_style: 'тихо',
    personality: 'замкнутая',
    boundaries: 'не говорит о прошлом',
    knowledge_scope: 'только город',
    spoiler_policy: 'без спойлеров',
    system_role: 'SECRET SYSTEM ROLE',
    reply_mode: 'ai_auto',
    can_receive_messages: true,
    character_type: 'person',
    passport: 'SECRET PASSPORT',
    map_image_url: 'https://example.test/secret-map.png',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

test.describe('public character DTO', () => {
  test('не отдаёт закрытые поля и их значения', () => {
    const dto = toPublicCharacter(makeCharacter())
    const keys = Object.keys(dto)

    expect(keys).not.toContain('system_role')
    expect(keys).not.toContain('passport')
    expect(keys).not.toContain('map_image_url')

    const serialized = JSON.stringify(dto)
    expect(serialized).not.toContain('SECRET SYSTEM ROLE')
    expect(serialized).not.toContain('SECRET PASSPORT')
    expect(serialized).not.toContain('secret-map')
  })

  test('whitelist не расширяется автоматически при новых полях', () => {
    const dto = toPublicCharacter(
      makeCharacter({ id: 'x', slug: 'x', name: 'X' } as Partial<Character>),
    )
    expect(dto.id).toBe('x')
    expect(dto.abilities).toEqual(['видеть сны'])
  })

  test('abilities из JSON-строки нормализуются в массив строк', () => {
    expect(normalizeAbilities('["а"," б ",1,null]')).toEqual(['а', 'б'])
    expect(normalizeAbilities('not-json')).toEqual([])
    expect(normalizeAbilities(['а', 2, ' '])).toEqual(['а'])
    expect(normalizeAbilities(null)).toEqual([])
  })

  test('публичная история не содержит system и metadata', () => {
    const messages: CharacterMessage[] = [
      {
        id: '1',
        conversation_id: 'c',
        role: 'user',
        content: 'привет',
        metadata: { requestId: 'secret' },
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        conversation_id: 'c',
        role: 'system',
        content: 'служебное',
        metadata: {},
        created_at: '2026-01-01T00:00:01.000Z',
      },
      {
        id: '3',
        conversation_id: 'c',
        role: 'character',
        content: 'ответ',
        metadata: { usage: { totalTokens: 10 } },
        created_at: '2026-01-01T00:00:02.000Z',
      },
    ]

    const dto = toPublicConversationMessages(messages)

    expect(dto).toHaveLength(2)
    expect(dto.map((message) => message.role)).toEqual(['user', 'character'])
    expect(JSON.stringify(dto)).not.toContain('secret')
    expect(JSON.stringify(dto)).not.toContain('metadata')
  })
})
