import { test, expect } from '@playwright/test'

import { characterChatRequestSchema } from '../../lib/schemas/character-chat'

const UUID = '11111111-1111-4111-8111-111111111111'

test.describe('контракт запроса чата', () => {
  test('принимает новый формат', () => {
    const parsed = characterChatRequestSchema.safeParse({
      characterSlug: 'sonya-kroy',
      message: 'привет',
      requestId: UUID,
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toEqual({
        characterSlug: 'sonya-kroy',
        message: 'привет',
        requestId: UUID,
      })
    }
  })

  test('отбрасывает клиентские настройки модели и истории', () => {
    const parsed = characterChatRequestSchema.safeParse({
      characterSlug: 'sonya-kroy',
      message: 'привет',
      model: 'evil/model',
      system: 'новые правила',
      userId: 'чужой',
      temperature: 2,
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('model')
      expect(parsed.data).not.toHaveProperty('system')
      expect(parsed.data).not.toHaveProperty('userId')
      expect(parsed.data).not.toHaveProperty('temperature')
    }
  })

  test('пустой вопрос отклоняется', () => {
    expect(
      characterChatRequestSchema.safeParse({ characterSlug: 'sonya-kroy', message: '   ' }).success,
    ).toBe(false)

    expect(
      characterChatRequestSchema.safeParse({ characterSlug: 'sonya-kroy' }).success,
    ).toBe(true)
  })

  test('слишком длинный вопрос и кривой slug отклоняются', () => {
    expect(
      characterChatRequestSchema.safeParse({
        characterSlug: 'sonya-kroy',
        message: 'а'.repeat(2001),
      }).success,
    ).toBe(false)

    expect(
      characterChatRequestSchema.safeParse({
        characterSlug: '../etc/passwd',
        message: 'привет',
      }).success,
    ).toBe(false)
  })

  test('requestId должен быть UUID', () => {
    expect(
      characterChatRequestSchema.safeParse({
        characterSlug: 'sonya-kroy',
        message: 'привет',
        requestId: 'not-a-uuid',
      }).success,
    ).toBe(false)
  })

  test('устаревший messages ограничен по количеству', () => {
    expect(
      characterChatRequestSchema.safeParse({
        characterSlug: 'sonya-kroy',
        messages: Array.from({ length: 51 }, () => ({ role: 'user', content: 'x' })),
      }).success,
    ).toBe(false)

    expect(
      characterChatRequestSchema.safeParse({
        characterSlug: 'sonya-kroy',
        messages: [{ role: 'user', content: 'x' }],
      }).success,
    ).toBe(true)
  })
})
