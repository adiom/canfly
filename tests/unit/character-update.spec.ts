import { test, expect } from '@playwright/test'

import { buildCharacterUpdateData, parseAbilities } from '../../lib/studio/character-update'

function formOf(entries: Record<string, string>): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(entries)) form.set(key, value)
  return form
}

test.describe('Studio: PATCH-семантика формы персонажа', () => {
  test('отсутствующее поле не попадает в UPDATE', () => {
    const data = buildCharacterUpdateData(formOf({ bio: 'новое bio' }), {
      character_type: 'person',
    })

    expect(data).toEqual({ bio: 'новое bio' })
    expect('passport' in data).toBe(false)
    expect('abilities' in data).toBe(false)
    expect('map_image_url' in data).toBe(false)
    expect('system_role' in data).toBe(false)
  })

  test('пустое присланное поле очищает значение явно', () => {
    const data = buildCharacterUpdateData(
      formOf({ passport: '   ', map_image_url: '', abilities: '\n  \n' }),
      { character_type: 'person' },
    )

    expect(data.passport).toBeNull()
    expect(data.map_image_url).toBeNull()
    expect(data.abilities).toEqual([])
  })

  test('abilities из textarea собираются по строкам', () => {
    expect(parseAbilities('одна\n\n две \nтри ')).toEqual(['одна', 'две', 'три'])
    expect(parseAbilities('')).toEqual([])

    const data = buildCharacterUpdateData(formOf({ abilities: 'летать\nвидеть сны' }), {
      character_type: 'person',
    })
    expect(data.abilities).toEqual(['летать', 'видеть сны'])
  })

  test('пустой system_role — осознанное отключение речи, а не пропуск', () => {
    const data = buildCharacterUpdateData(formOf({ system_role: '' }), {
      character_type: 'person',
    })

    expect('system_role' in data).toBe(true)
    expect(data.system_role).toBe('')
  })

  test('смена типа на city очищает AI-поля', () => {
    const data = buildCharacterUpdateData(formOf({ character_type: 'city' }), {
      character_type: 'person',
    })

    expect(data.character_type).toBe('city')
    expect(data.abilities).toEqual([])
    expect(data.system_role).toBe('')
    expect(data.reply_mode).toBe('disabled')
    expect(data.can_receive_messages).toBe(false)
    expect(data.personality).toBeNull()
  })

  test('city → city не стирает поля при обычном сохранении', () => {
    const data = buildCharacterUpdateData(formOf({ bio: 'город' }), {
      character_type: 'city',
    })

    expect(data).toEqual({ bio: 'город' })
  })

  test('неизвестные поля формы игнорируются', () => {
    const data = buildCharacterUpdateData(
      formOf({ bio: 'x', is_admin: 'true', owner_id: 'чужой' }),
      { character_type: 'person' },
    )

    expect(data).toEqual({ bio: 'x' })
  })
})
