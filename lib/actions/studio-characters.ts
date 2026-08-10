'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { put } from '@vercel/blob'

import { requireAuthorOrAdminSession, requireStudioAdminSession } from '@/lib/server/studio-auth'
import * as charactersDb from '@/lib/server/characters'
import * as postsDb from '@/lib/server/character-posts'
import * as wallDb from '@/lib/server/character-wall'
import * as relationshipsDb from '@/lib/server/character-relationships'
import * as usersDb from '@/lib/server/users'
import type { CharacterFriendshipStatus, CharacterReplyMode, CharacterType } from '@/lib/types'
import {
  characterRelationshipSchema,
  deleteCharacterRelationshipSchema,
} from '@/lib/schemas/character-relationships'
import {
  createCharacterPostSchema,
  formatZodError,
  updateCharacterPostSchema,
} from '@/lib/schemas/character-post'

const VALID_REPLY_MODES: CharacterReplyMode[] = ['ai_auto', 'manual', 'hybrid', 'disabled']
const VALID_CHARACTER_TYPES: CharacterType[] = ['person', 'city']

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

function str(form: FormData, key: string): string {
  const v = form.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

function strOrNull(form: FormData, key: string): string | null {
  const v = str(form, key)
  return v.length > 0 ? v : null
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

function parseAbilities(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

// ── Characters CRUD ─────────────────────────────────────────────────────────

export async function getStudioCharacters() {
  await requireAdmin()
  return charactersDb.fetchCharactersList()
}

export async function getStudioCities() {
  await requireAdmin()
  return charactersDb.fetchCitiesList()
}

export async function getStudioAllCharacters() {
  await requireAuthorOrAdmin()
  return charactersDb.fetchAllCharactersList()
}

export async function getStudioCharacter(id: string) {
  await requireAuthorOrAdmin()
  return charactersDb.fetchCharacterById(id)
}

export async function createCharacterAction(formData: FormData) {
  await requireAdmin()

  const characterType = normalizeCharacterType(formData.get('character_type'))

  const data: Record<string, unknown> = {
    name: str(formData, 'name'),
    slug: str(formData, 'slug'),
    avatar: strOrNull(formData, 'avatar'),
    bio: strOrNull(formData, 'bio'),
    full_description: strOrNull(formData, 'full_description'),
    character_type: characterType,
    passport: strOrNull(formData, 'passport'),
    map_image_url: strOrNull(formData, 'map_image_url'),
  }

  if (characterType === 'person') {
    data.abilities = parseAbilities(str(formData, 'abilities'))
    data.speaking_style = strOrNull(formData, 'speaking_style')
    data.personality = strOrNull(formData, 'personality')
    data.boundaries = strOrNull(formData, 'boundaries')
    data.knowledge_scope = strOrNull(formData, 'knowledge_scope')
    data.spoiler_policy = strOrNull(formData, 'spoiler_policy')
    data.system_role = str(formData, 'system_role').trim().slice(0, 8000)
    data.reply_mode = normalizeReplyMode(formData.get('reply_mode'))
    data.can_receive_messages = formData.get('can_receive_messages') !== 'false'
  } else {
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

  const character = await charactersDb.createCharacter(data)

  revalidatePath('/studio/characters')
  revalidatePath('/characters')
  if (character) redirect(`/studio/characters/${character.id}`)
}

export async function updateCharacterAction(id: string, formData: FormData) {
  await requireAdmin()

  const characterType = normalizeCharacterType(formData.get('character_type'))

  const data: Record<string, unknown> = {
    name: str(formData, 'name'),
    slug: str(formData, 'slug'),
    avatar: strOrNull(formData, 'avatar'),
    bio: strOrNull(formData, 'bio'),
    full_description: strOrNull(formData, 'full_description'),
    character_type: characterType,
    passport: strOrNull(formData, 'passport'),
    map_image_url: strOrNull(formData, 'map_image_url'),
  }

  if (characterType === 'person') {
    data.abilities = parseAbilities(str(formData, 'abilities'))
    data.speaking_style = strOrNull(formData, 'speaking_style')
    data.personality = strOrNull(formData, 'personality')
    data.boundaries = strOrNull(formData, 'boundaries')
    data.knowledge_scope = strOrNull(formData, 'knowledge_scope')
    data.spoiler_policy = strOrNull(formData, 'spoiler_policy')
    data.system_role = str(formData, 'system_role').trim().slice(0, 8000)
    data.reply_mode = normalizeReplyMode(formData.get('reply_mode'))
    data.can_receive_messages = formData.get('can_receive_messages') !== 'false'
  } else {
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

  await charactersDb.updateCharacter(id, data)

  revalidatePath('/studio/characters')
  revalidatePath(`/studio/characters/${id}`)
  revalidatePath('/characters')
  redirect(`/studio/characters/${id}`)
}

export async function updatePassportAction(id: string, formData: FormData) {
  await requireAuthorOrAdmin()

  const passport = strOrNull(formData, 'passport')
  await charactersDb.updatePassport(id, passport)

  revalidatePath(`/studio/characters/${id}`)
  redirect(`/studio/characters/${id}`)
}

export async function deleteCharacterAction(id: string) {
  await requireAdmin()
  await charactersDb.deleteCharacter(id)
  revalidatePath('/studio/characters')
  revalidatePath('/characters')
  redirect('/studio/characters')
}

// ── Character posts ─────────────────────────────────────────────────────────

export async function listStudioCharacterPosts(characterId: string) {
  await requireAdmin()
  return postsDb.listCharacterPostsAdmin(characterId)
}

export async function createCharacterPostAction(characterId: string, formData: FormData) {
  const { user } = await requireAdmin()

  const parsed = createCharacterPostSchema.safeParse({
    content: str(formData, 'content'),
    post_type: formData.get('post_type'),
    image_url: str(formData, 'image_url'),
    scheduled_at: str(formData, 'scheduled_at'),
    remove_image: formData.get('remove_image'),
  })
  if (!parsed.success) throw new Error(formatZodError(parsed.error))

  let imageUrl = parsed.data.image_url ?? null

  const file = formData.get('image_file')
  if (file instanceof File && file.size > 0) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN не настроен — загрузка изображений недоступна')
    }
    const ext = file.name.split('.').pop() || 'bin'
    const filename = `character-posts/${characterId}/${Date.now()}-${crypto.randomUUID()}.${ext}`
    const blob = await put(filename, file, { access: 'public' })
    imageUrl = blob.url
  }

  await postsDb.createCharacterPost({
    character_id: characterId,
    content: parsed.data.content,
    post_type: parsed.data.post_type,
    image_url: imageUrl,
    scheduled_at: parsed.data.scheduled_at ?? null,
    author_user_id: user.id,
  })

  revalidatePath(`/studio/characters/${characterId}`)
  redirect(`/studio/characters/${characterId}`)
}

export async function updateCharacterPostAction(postId: string, formData: FormData) {
  await requireAdmin()

  const existing = await postsDb.fetchCharacterPostById(postId)
  if (!existing) throw new Error('Пост не найден')

  const parsed = updateCharacterPostSchema.safeParse({
    content: str(formData, 'content'),
    post_type: formData.get('post_type'),
    image_url: str(formData, 'image_url'),
    scheduled_at: str(formData, 'scheduled_at'),
    remove_image: formData.get('remove_image'),
  })
  if (!parsed.success) throw new Error(formatZodError(parsed.error))

  let imageUrl: string | null = parsed.data.image_url ?? existing.image_url
  const file = formData.get('image_file')
  if (file instanceof File && file.size > 0) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN не настроен — загрузка изображений недоступна')
    }
    const ext = file.name.split('.').pop() || 'bin'
    const filename = `character-posts/${existing.character_id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
    const blob = await put(filename, file, { access: 'public' })
    imageUrl = blob.url
  }

  if (parsed.data.remove_image) imageUrl = null

  await postsDb.updateCharacterPost(postId, {
    content: parsed.data.content ?? existing.content,
    post_type: parsed.data.post_type ?? existing.post_type,
    image_url: imageUrl,
    scheduled_at:
      parsed.data.scheduled_at !== undefined ? parsed.data.scheduled_at : existing.scheduled_at,
  })

  revalidatePath(`/studio/characters/${existing.character_id}`)
  redirect(`/studio/characters/${existing.character_id}`)
}

export async function deleteCharacterPostAction(postId: string) {
  await requireAdmin()
  const existing = await postsDb.fetchCharacterPostById(postId)
  if (!existing) return
  await postsDb.deleteCharacterPost(postId)
  revalidatePath(`/studio/characters/${existing.character_id}`)
}

// ── Wall moderation ─────────────────────────────────────────────────────────

export async function listStudioWallPosts(characterId: string) {
  await requireAdmin()
  return wallDb.fetchWallPosts(characterId, { includeHidden: true, limit: 200 })
}

export async function setWallPostHiddenAction(wallPostId: string, hidden: boolean) {
  await requireAdmin()
  const updated = await wallDb.setWallPostHidden(wallPostId, hidden)
  if (updated) revalidatePath(`/studio/characters/${updated.character_id}`)
}

export async function deleteStudioWallPostAction(wallPostId: string) {
  await requireAdmin()
  const existing = await wallDb.fetchWallPostById(wallPostId)
  if (!existing) return
  await wallDb.deleteWallPost(wallPostId)
  revalidatePath(`/studio/characters/${existing.character_id}`)
}

// ── Character ↔ Character relationships ─────────────────────────────────────

/**
 * Список всех исходящих связей персонажа с пометкой взаимности.
 * Нужен редактору связей в Studio. Авторизация — author/admin, как и
 * остальные операции чтения в Studio (см. `getStudioCharacter`).
 */
export async function listStudioCharacterRelationships(characterId: string) {
  await requireAuthorOrAdmin()
  return relationshipsDb.fetchCharacterRelationships(characterId)
}

/**
 * Upsert связи. Автор/админ. Связь всегда принадлежит персонажу,
 * чей id указан в characterId — мутация чужой строки не пройдёт по
 * character_id в `upsertCharacterRelationship`.
 */
export async function upsertCharacterRelationshipAction(formData: FormData) {
  await requireAuthorOrAdmin()

  const parsed = characterRelationshipSchema.safeParse({
    characterId: str(formData, 'characterId'),
    relatedCharacterId: str(formData, 'relatedCharacterId'),
    relationshipType: str(formData, 'relationshipType'),
    description: strOrNull(formData, 'description'),
    custom: formData.get('custom') === 'on' || formData.get('custom') === 'true',
  })
  if (!parsed.success) throw new Error(formatZodError(parsed.error))

  await relationshipsDb.upsertCharacterRelationship({
    characterId: parsed.data.characterId,
    relatedCharacterId: parsed.data.relatedCharacterId,
    relationshipType: parsed.data.relationshipType,
    description: parsed.data.description ?? null,
  })

  revalidatePath(`/studio/characters/${parsed.data.characterId}`)
}

/**
 * Удаление связи по id. В схеме дополнительно передаётся characterId —
 * удаляем только если строка принадлежит этому персонажу (защита от
 * IDOR через подмену relationshipId в форме).
 */
export async function deleteCharacterRelationshipAction(formData: FormData) {
  await requireAuthorOrAdmin()

  const parsed = deleteCharacterRelationshipSchema.safeParse({
    relationshipId: str(formData, 'relationshipId'),
    characterId: str(formData, 'characterId'),
  })
  if (!parsed.success) throw new Error(formatZodError(parsed.error))

  await relationshipsDb.deleteCharacterRelationship(
    parsed.data.relationshipId,
    parsed.data.characterId,
  )

  revalidatePath(`/studio/characters/${parsed.data.characterId}`)
}

/**
 * Поиск персонажей для формы «выберите цель связи». Возвращает результат
 * через JSON — это позволяет не тащить весь список персонажей на клиент.
 */
export async function searchCharactersForRelationshipAction(
  excludeCharacterId: string,
  query: string,
): Promise<Array<{ id: string; name: string; slug: string; avatar: string | null; character_type: 'person' | 'city' }>> {
  await requireAuthorOrAdmin()
  return relationshipsDb.searchCharactersForRelationship({
    excludeCharacterId,
    query,
  })
}

// ── Character ↔ User readers (friendships) ──────────────────────────────────

const VALID_FRIENDSHIP_STATUSES: CharacterFriendshipStatus[] = [
  'pending',
  'accepted',
  'blocked',
]

function normalizeFriendshipStatus(value: unknown): CharacterFriendshipStatus {
  return typeof value === 'string' &&
    VALID_FRIENDSHIP_STATUSES.includes(value as CharacterFriendshipStatus)
    ? (value as CharacterFriendshipStatus)
    : 'pending'
}

export async function listStudioCharacterReaders(characterId: string) {
  await requireAuthorOrAdmin()
  return usersDb.listCharacterReaders(characterId)
}

export async function setCharacterReaderStatusAction(formData: FormData) {
  await requireAuthorOrAdmin()

  const characterId = str(formData, 'characterId')
  const userId = str(formData, 'userId')
  const status = normalizeFriendshipStatus(formData.get('status'))

  if (!characterId || !userId) {
    throw new Error('Не хватает параметров characterId/userId')
  }

  await usersDb.setCharacterReaderStatus(userId, characterId, status)
  revalidatePath(`/studio/characters/${characterId}`)
}

export async function deleteCharacterReaderAction(formData: FormData) {
  await requireAuthorOrAdmin()

  const characterId = str(formData, 'characterId')
  const userId = str(formData, 'userId')

  if (!characterId || !userId) {
    throw new Error('Не хватает параметров characterId/userId')
  }

  await usersDb.adminDeleteCharacterFriendship(userId, characterId)
  revalidatePath(`/studio/characters/${characterId}`)
}
