'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  listMyNews,
  fetchNewsForEdit,
  requireNewsOwnership,
  updateNews,
  updateNewsStatus,
  deleteNews,
} from '@/lib/server/news-studio'
import { requireStudioSession } from '@/lib/server/studio-auth'
import { newsFormSchema, newsStatusSchema } from '@/lib/schemas/studio-news'

export async function getMyNews() {
  const session = await requireStudioSession()
  if (!session) redirect('/login')
  return listMyNews(session)
}

export async function getNewsForEdit(id: string) {
  await requireNewsOwnership(id)
  return fetchNewsForEdit(id)
}

export async function updateNewsAction(id: string, formData: FormData) {
  await requireNewsOwnership(id)

  const result = newsFormSchema.safeParse(Object.fromEntries(formData))
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'Ошибка валидации')
  }

  await updateNews(id, result.data)

  revalidatePath(`/studio/news/${id}`)
  revalidatePath('/studio/news')
  revalidatePath('/news')
}

export async function updateNewsStatusAction(id: string, status: string) {
  await requireNewsOwnership(id)

  const parsed = newsStatusSchema.safeParse(status)
  if (!parsed.success) {
    throw new Error('Недопустимый статус новости')
  }

  await updateNewsStatus(id, parsed.data)

  revalidatePath(`/studio/news/${id}`)
  revalidatePath('/studio/news')
  revalidatePath('/news')
}

export async function deleteNewsAction(id: string) {
  await requireNewsOwnership(id)
  await deleteNews(id)

  revalidatePath('/studio/news')
  revalidatePath('/news')
  redirect('/studio/news')
}
