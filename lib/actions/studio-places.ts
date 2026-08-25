'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAuthorOrAdminSession, requireStudioAdminSession } from '@/lib/server/studio-auth'
import * as placesDb from '@/lib/server/places'

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

// ── Places CRUD ──────────────────────────────────────────────────────────────

export async function getStudioPlaces() {
  await requireAdmin()
  return placesDb.fetchAllPlaces()
}

export async function getStudioPlace(id: string) {
  await requireAuthorOrAdmin()
  return placesDb.fetchPlaceById(id)
}

export async function createPlaceAction(formData: FormData) {
  await requireAdmin()

  const data: Record<string, unknown> = {
    name: str(formData, 'name'),
    slug: str(formData, 'slug'),
    avatar: strOrNull(formData, 'avatar'),
    bio: strOrNull(formData, 'bio'),
    full_description: strOrNull(formData, 'full_description'),
    map_image_url: strOrNull(formData, 'map_image_url'),
    theme_color: strOrNull(formData, 'theme_color'),
    era: strOrNull(formData, 'era'),
  }

  const place = await placesDb.createPlace(data)

  revalidatePath('/studio/places')
  revalidatePath('/places')
  if (place) redirect(`/studio/places/${place.id}`)
}

export async function updatePlaceAction(id: string, formData: FormData) {
  await requireAdmin()

  const data: Record<string, unknown> = {
    name: str(formData, 'name'),
    slug: str(formData, 'slug'),
    avatar: strOrNull(formData, 'avatar'),
    bio: strOrNull(formData, 'bio'),
    full_description: strOrNull(formData, 'full_description'),
    map_image_url: strOrNull(formData, 'map_image_url'),
    theme_color: strOrNull(formData, 'theme_color'),
    era: strOrNull(formData, 'era'),
  }

  await placesDb.updatePlace(id, data)

  revalidatePath('/studio/places')
  revalidatePath(`/studio/places/${id}`)
  revalidatePath('/places')
  redirect(`/studio/places/${id}`)
}

export async function deletePlaceAction(id: string) {
  await requireAdmin()
  await placesDb.deletePlace(id)
  revalidatePath('/studio/places')
  revalidatePath('/places')
  redirect('/studio/places')
}
