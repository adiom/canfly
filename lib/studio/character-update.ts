import type { Character, CharacterReplyMode, CharacterType } from '@/lib/types'

const VALID_REPLY_MODES: CharacterReplyMode[] = ['ai_auto', 'manual', 'hybrid', 'disabled']
const VALID_CHARACTER_TYPES: CharacterType[] = ['person', 'city']

function str(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function strOrNull(form: FormData, key: string): string | null {
  const value = str(form, key)
  return value.length > 0 ? value : null
}

export function parseAbilities(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function normalizeReplyMode(value: unknown): CharacterReplyMode {
  return typeof value === 'string' && VALID_REPLY_MODES.includes(value as CharacterReplyMode)
    ? (value as CharacterReplyMode)
    : 'ai_auto'
}

function normalizeCharacterType(value: unknown): CharacterType {
  return typeof value === 'string' && VALID_CHARACTER_TYPES.includes(value as CharacterType)
    ? (value as CharacterType)
    : 'person'
}

/**
 * PATCH-семантика старой формы Studio: в UPDATE попадают только те поля,
 * которые форма реально прислала. Если поля нет (`passport`, `abilities`,
 * `map_image_url`), оно остаётся прежним. Явное очищение — присланное пустое
 * значение, а не отсутствие поля.
 */
export function buildCharacterUpdateData(
  formData: FormData,
  existing: Pick<Character, 'character_type'>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {}

  if (formData.has('name')) {
    const name = str(formData, 'name')
    if (name) data.name = name
  }
  if (formData.has('slug')) {
    const slug = str(formData, 'slug')
    if (slug) data.slug = slug
  }
  if (formData.has('avatar')) data.avatar = strOrNull(formData, 'avatar')
  if (formData.has('bio')) data.bio = strOrNull(formData, 'bio')
  if (formData.has('full_description')) {
    data.full_description = strOrNull(formData, 'full_description')
  }
  if (formData.has('passport')) data.passport = strOrNull(formData, 'passport')
  if (formData.has('map_image_url')) data.map_image_url = strOrNull(formData, 'map_image_url')

  if (formData.has('character_type')) {
    data.character_type = normalizeCharacterType(formData.get('character_type'))
  }

  if (formData.has('abilities')) data.abilities = parseAbilities(str(formData, 'abilities'))
  if (formData.has('speaking_style')) data.speaking_style = strOrNull(formData, 'speaking_style')
  if (formData.has('personality')) data.personality = strOrNull(formData, 'personality')
  if (formData.has('boundaries')) data.boundaries = strOrNull(formData, 'boundaries')
  if (formData.has('knowledge_scope')) {
    data.knowledge_scope = strOrNull(formData, 'knowledge_scope')
  }
  if (formData.has('spoiler_policy')) {
    data.spoiler_policy = strOrNull(formData, 'spoiler_policy')
  }
  if (formData.has('system_role')) {
    data.system_role = str(formData, 'system_role').slice(0, 8000)
  }
  if (formData.has('reply_mode')) {
    data.reply_mode = normalizeReplyMode(formData.get('reply_mode'))
  }
  if (formData.has('can_receive_messages')) {
    data.can_receive_messages = formData.get('can_receive_messages') !== 'false'
  }

  // Смена типа на «город» — явное намерение: у города нет AI-полей. В обычном
  // сохранении человека ничего не обнуляется.
  if (data.character_type === 'city' && existing.character_type !== 'city') {
    data.abilities = []
    data.speaking_style = null
    data.personality = null
    data.boundaries = null
    data.knowledge_scope = null
    data.spoiler_policy = null
    data.system_role = ''
    data.reply_mode = 'disabled'
    data.can_receive_messages = false
  }

  return data
}
