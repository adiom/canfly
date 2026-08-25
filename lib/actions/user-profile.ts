'use server'

import { revalidatePath } from 'next/cache'
import { dbQuery, dbQueryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/server/session'
import { isHandleAvailable } from '@/lib/server/user-profile'
import { sanitizePlainText } from '@/lib/sanitize'
import {
  handleSchema,
  identitySchema,
  signatureColorSchema,
  visibilitySchema,
} from '@/lib/schemas/user-profile'

export interface ActionResult {
  status: 'idle' | 'success' | 'error'
  message?: string
}

/** Смена handle меняет публичный URL — редко и осознанно. */
const HANDLE_COOLDOWN_DAYS = 14

function revalidateProfile(handle?: string | null) {
  revalidatePath('/user')
  revalidatePath('/user-settings')
  if (handle) revalidatePath(`/user/${handle}`)
}

export async function updateIdentity(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { status: 'error', message: 'Необходима авторизация' }

  const parsed = identitySchema.safeParse({
    display_name: formData.get('display_name')?.toString() ?? '',
    tagline: formData.get('tagline')?.toString() ?? '',
    bio: formData.get('bio')?.toString() ?? '',
  })
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Ошибка валидации' }
  }

  // Профиль публичен — текст чистим перед записью, а не при рендере
  const { display_name, tagline, bio } = parsed.data
  await dbQuery(
    `UPDATE users
     SET display_name = $2, tagline = $3, bio = $4, updated_at = NOW()
     WHERE id = $1`,
    [
      user.id,
      sanitizePlainText(display_name),
      tagline ? sanitizePlainText(tagline) : null,
      bio ? sanitizePlainText(bio) : null,
    ],
  )

  revalidateProfile(user.handle)
  return { status: 'success', message: 'Сохранено' }
}

export async function changeHandle(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { status: 'error', message: 'Необходима авторизация' }

  const parsed = handleSchema.safeParse({ handle: formData.get('handle')?.toString() ?? '' })
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Ошибка валидации' }
  }

  const { handle } = parsed.data
  if (handle === user.handle) {
    return { status: 'success', message: 'Это уже твой адрес' }
  }

  const current = await dbQueryOne<{ handle_changed_at: string | null }>(
    'SELECT handle_changed_at FROM users WHERE id = $1',
    [user.id],
  )
  if (current?.handle_changed_at) {
    const daysPassed =
      (Date.now() - new Date(current.handle_changed_at).getTime()) / 86_400_000
    if (daysPassed < HANDLE_COOLDOWN_DAYS) {
      const left = Math.ceil(HANDLE_COOLDOWN_DAYS - daysPassed)
      return { status: 'error', message: `Адрес можно менять раз в 14 дней. Осталось ${left} дн.` }
    }
  }

  if (!(await isHandleAvailable(handle, user.id))) {
    return { status: 'error', message: 'Этот адрес занят' }
  }

  try {
    await dbQuery(
      'UPDATE users SET handle = $2, handle_changed_at = NOW(), updated_at = NOW() WHERE id = $1',
      [user.id, handle],
    )
  } catch (error) {
    // Гонка между проверкой и записью: уникальный индекс — последнее слово
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return { status: 'error', message: 'Этот адрес занят' }
    }
    throw error
  }

  revalidateProfile(user.handle)
  revalidateProfile(handle)
  return { status: 'success', message: `Теперь ты @${handle}` }
}

export async function updateSignatureColor(colorId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { status: 'error', message: 'Необходима авторизация' }

  const parsed = signatureColorSchema.safeParse({ signature_color: colorId })
  if (!parsed.success) {
    return { status: 'error', message: 'Неизвестный цвет' }
  }

  await dbQuery('UPDATE users SET signature_color = $2, updated_at = NOW() WHERE id = $1', [
    user.id,
    parsed.data.signature_color,
  ])

  revalidateProfile(user.handle)
  return { status: 'success', message: 'Цвет обновлён' }
}

export async function updateVisibility(input: {
  profile_is_public: boolean
  show_reading: boolean
}): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { status: 'error', message: 'Необходима авторизация' }

  const parsed = visibilitySchema.safeParse(input)
  if (!parsed.success) {
    return { status: 'error', message: 'Ошибка валидации' }
  }

  await dbQuery(
    `UPDATE users
     SET profile_is_public = $2, show_reading = $3, updated_at = NOW()
     WHERE id = $1`,
    [user.id, parsed.data.profile_is_public, parsed.data.show_reading],
  )

  revalidateProfile(user.handle)
  return { status: 'success', message: 'Сохранено' }
}

/**
 * Порядок и набор работ на публичной странице автора.
 * null = все (fallback), [] = ничего, [id1, id2, ...] = только эти в этом порядке.
 */
export async function updateShowcaseReleases(releaseIds: string[]): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { status: 'error', message: 'Необходима авторизация' }

  // Валидация: max 50 ID, все UUID
  if (releaseIds.length > 50) {
    return { status: 'error', message: 'Максимум 50 работ' }
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89abAB][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (releaseIds.some(id => !UUID_RE.test(id))) {
    return { status: 'error', message: 'Невалидный ID релиза' }
  }

  await dbQuery(
    'UPDATE users SET showcase_releases = $2, updated_at = NOW() WHERE id = $1',
    [user.id, releaseIds.length > 0 ? releaseIds : null],
  )

  revalidateProfile(user.handle)
  return { status: 'success', message: 'Витрина обновлена' }
}

export async function updateAvatar(url: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { status: 'error', message: 'Необходима авторизация' }

  // Принимаем только то, что вернул наш загрузчик в Blob — не произвольный URL
  if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url)) {
    return { status: 'error', message: 'Недопустимый адрес изображения' }
  }

  await dbQuery('UPDATE users SET avatar = $2, updated_at = NOW() WHERE id = $1', [user.id, url])

  revalidateProfile(user.handle)
  return { status: 'success', message: 'Аватар обновлён' }
}
