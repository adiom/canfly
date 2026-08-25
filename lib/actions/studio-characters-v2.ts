'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireAuthorOrAdminSession, requireStudioAdminSession } from '@/lib/server/studio-auth'
import * as charactersDb from '@/lib/server/characters'
import {
  createPassportVersion,
  fetchPassportVersions,
  restorePassportVersion,
  type CharacterPassportVersion,
} from '@/lib/server/character-passport-versions'
import type { Character, CharacterReplyMode } from '@/lib/types'

const VALID_REPLY_MODES: CharacterReplyMode[] = ['ai_auto', 'manual', 'hybrid', 'disabled']

async function requireAdmin() {
  const session = await requireStudioAdminSession()
  if (!session) redirect('/login')
  return session
}

async function requireAuthorOrAdmin() {
  const session = await requireAuthorOrAdminSession()
  if (!session) redirect('/login')
  return session
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional()

const faceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  avatar: nullableText(2000),
  bio: nullableText(4000),
  full_description: nullableText(20000),
})

const voiceSchema = z.object({
  personality: nullableText(8000),
  speaking_style: nullableText(8000),
  // Системная инструкция модели — длинная, но ограничена 8000 как в старом action.
  system_role: z
    .string()
    .trim()
    .max(8000)
    .optional()
    .transform((v) => (v ?? '').slice(0, 8000)),
})

const conductSchema = z.object({
  reply_mode: z.enum(VALID_REPLY_MODES as [CharacterReplyMode, ...CharacterReplyMode[]]).optional(),
  can_receive_messages: z.boolean().optional(),
  boundaries: nullableText(8000),
  knowledge_scope: nullableText(8000),
  spoiler_policy: nullableText(8000),
})

const abilitiesSchema = z.object({
  abilities: z
    .array(z.string().trim().max(200))
    .max(200)
    .transform((arr) => arr.filter((s) => s.length > 0)),
})

const passportSchema = z.object({
  passport: z.string().max(60000).nullable(),
})

// ── Character core fields ────────────────────────────────────────────────────
// Все персонажи — люди (города живут отдельно, в таблице places); переключения
// типа person|city в v2-редакторе нет. Старое поле map_image_url здесь не
// редактируется — оно осталось в схеме как артефакт миграции 006.

export async function updateFaceAction(
  id: string,
  data: z.infer<typeof faceSchema>,
): Promise<Character | null> {
  await requireAdmin()
  const parsed = faceSchema.safeParse(data)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Ошибка валидации')

  const updated = await charactersDb.updateCharacter(id, parsed.data)
  revalidatePath(`/studio/characters-v2/${id}`)
  return updated
}

export async function updateVoiceAction(
  id: string,
  data: z.infer<typeof voiceSchema>,
): Promise<Character | null> {
  await requireAdmin()
  const parsed = voiceSchema.safeParse(data)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Ошибка валидации')

  const updated = await charactersDb.updateCharacter(id, parsed.data)
  revalidatePath(`/studio/characters-v2/${id}`)
  return updated
}

export async function updateConductAction(
  id: string,
  data: z.infer<typeof conductSchema>,
): Promise<Character | null> {
  await requireAdmin()
  const parsed = conductSchema.safeParse(data)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Ошибка валидации')

  const updated = await charactersDb.updateCharacter(id, parsed.data)
  revalidatePath(`/studio/characters-v2/${id}`)
  return updated
}

export async function updateAbilitiesAction(
  id: string,
  data: z.infer<typeof abilitiesSchema>,
): Promise<Character | null> {
  await requireAdmin()
  const parsed = abilitiesSchema.safeParse(data)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Ошибка валидации')

  const updated = await charactersDb.updateCharacter(id, {
    abilities: parsed.data.abilities,
  })
  revalidatePath(`/studio/characters-v2/${id}`)
  return updated
}

// ── Passport (markdown + версионность) ───────────────────────────────────────

/**
 * Сохраняет паспорт (markdown). Перед перезаписью сохраняет старое содержимое
 * в character_passport_versions — по образцу updateChapterAction
 * (lib/actions/studio.ts:367). Пустой старый паспорт не версионруется.
 */
export async function savePassportAction(
  id: string,
  markdown: string,
): Promise<Character | null> {
  await requireAuthorOrAdmin()
  const parsed = passportSchema.safeParse({ passport: markdown })
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Ошибка валидации')

  const next = (parsed.data.passport ?? '').trim() ? parsed.data.passport : null

  const character = await charactersDb.fetchCharacterById(id)
  if (!character) return null

  if (character.passport && next !== character.passport) {
    await createPassportVersion(id, character.passport)
  }

  const updated = await charactersDb.updatePassport(id, next)
  revalidatePath(`/studio/characters-v2/${id}`)
  return updated
}

/** История ревизий паспорта для v2-редактора. */
export async function listPassportVersionsAction(id: string): Promise<CharacterPassportVersion[]> {
  await requireAuthorOrAdmin()
  return fetchPassportVersions(id)
}

/**
 * Восстановление ревизии: текущий паспорт уходит в историю, затем в
 * characters.passport пишется содержимое выбранной версии.
 */
export async function restorePassportVersionAction(
  id: string,
  versionId: string,
): Promise<Character | null> {
  await requireAuthorOrAdmin()
  await restorePassportVersion(id, versionId)
  const updated = await charactersDb.fetchCharacterById(id)
  revalidatePath(`/studio/characters-v2/${id}`)
  return updated
}
