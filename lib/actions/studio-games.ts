'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { gameFormSchema } from '@/lib/schemas/games'
import { fetchCharactersList } from '@/lib/server/characters'
import * as gamesDb from '@/lib/server/games'
import { listAllReleases } from '@/lib/server/releases'
import { requireAuthorOrAdminSession, requireStudioAdminSession } from '@/lib/server/studio-auth'

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

/**
 * Мультиселекты приходят повторяющимся полем, поэтому их достаём отдельно:
 * `Object.fromEntries` оставил бы только последнее значение.
 */
function parseGameForm(formData: FormData) {
  return gameFormSchema.parse({
    ...Object.fromEntries(formData),
    character_ids: formData.getAll('character_ids'),
    release_ids: formData.getAll('release_ids'),
  })
}

function toRecord(input: ReturnType<typeof parseGameForm>) {
  return {
    title: input.title,
    slug: input.slug,
    tagline: input.tagline,
    description: input.description,
    cover_image: input.cover_image,
    aspect_ratio: input.aspect_ratio,
    display_order: input.display_order,
    is_published: input.is_published,
  }
}

function revalidateGamePages(slug: string) {
  revalidatePath('/studio/games')
  revalidatePath('/games')
  revalidatePath(`/games/${slug}`)
}

/**
 * Связи влияют на страницы персонажей и релизов, а те кэшируются: после
 * правки списка связей сбрасываем и их. Слаги берём из БД (а не из формы),
 * чтобы не зависеть от того, что пришло в запросе.
 */
async function readLinkedSlugs(gameId: string) {
  const [characters, releases] = await Promise.all([
    gamesDb.fetchGameCharacters(gameId),
    gamesDb.fetchGameReleases(gameId, { onlyPublished: false }),
  ])
  return {
    characterSlugs: characters.map(character => character.character_slug),
    releaseSlugs: releases.map(release => release.release_slug),
  }
}

function revalidateLinkedPages(links: { characterSlugs: string[]; releaseSlugs: string[] }) {
  for (const slug of links.characterSlugs) revalidatePath(`/characters/${slug}`)
  for (const slug of links.releaseSlugs) revalidatePath(`/release/${slug}`)
}

// ── Games CRUD ───────────────────────────────────────────────────────────────

export async function getStudioGames() {
  await requireAdmin()
  return gamesDb.fetchAllGames()
}

export async function getStudioGame(id: string) {
  await requireAuthorOrAdmin()

  const game = await gamesDb.fetchGameById(id)
  if (!game) return null

  const [characters, releases, allCharacters, allReleases] = await Promise.all([
    gamesDb.fetchGameCharacters(id),
    gamesDb.fetchGameReleases(id, { onlyPublished: false }),
    fetchCharactersList(),
    listAllReleases(),
  ])

  return {
    game,
    linkedCharacterIds: characters.map(character => character.character_id),
    linkedReleaseIds: releases.map(release => release.release_id),
    allCharacters,
    allReleases,
  }
}

export async function createGameAction(formData: FormData) {
  await requireAdmin()
  const input = parseGameForm(formData)

  const game = await gamesDb.createGame(toRecord(input))
  if (!game) redirect('/studio/games')

  await gamesDb.setGameCharacters(game.id, input.character_ids)
  await gamesDb.setGameReleases(game.id, input.release_ids)

  revalidateGamePages(game.slug)
  revalidateLinkedPages(await readLinkedSlugs(game.id))
  redirect(`/studio/games/${game.id}`)
}

export async function updateGameAction(id: string, formData: FormData) {
  await requireAdmin()
  const input = parseGameForm(formData)

  const previous = await gamesDb.fetchGameById(id)
  const game = await gamesDb.updateGame(id, toRecord(input))
  if (!game) redirect('/studio/games')

  await gamesDb.setGameCharacters(id, input.character_ids)
  await gamesDb.setGameReleases(id, input.release_ids)

  revalidateGamePages(game.slug)
  // Слаг могли поменять: старая страница больше не должна отдавать игру.
  if (previous && previous.slug !== game.slug) revalidatePath(`/games/${previous.slug}`)
  revalidateLinkedPages(await readLinkedSlugs(id))
  redirect(`/studio/games/${id}`)
}

export async function deleteGameAction(id: string) {
  await requireAdmin()

  const game = await gamesDb.fetchGameById(id)
  if (!game) redirect('/studio/games')

  // Слаги читаем до удаления: после каскада связей уже не будет.
  const linked = await readLinkedSlugs(id)
  await gamesDb.deleteGame(id)

  revalidateGamePages(game.slug)
  revalidateLinkedPages(linked)
  redirect('/studio/games')
}
