'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { dbQueryOne } from '@/lib/db'
import { createNewsDraft } from '@/lib/server/news-studio'
import { requireStudioSession } from '@/lib/server/studio-auth'
import { generateSlug } from '@/lib/slug-utils'

export type DraftType = 'release' | 'news'

/**
 * Создаёт пустой черновик выбранного типа и редиректит в редактор Studio.
 * UX-контракт: кнопка «+ НОВЫЙ» → хаб /studio/new → выбор типа → мгновенный
 * INSERT пустой строки (status='draft') → редирект в редактор.
 */
export async function createDraftAction(formData: FormData) {
  const session = await requireStudioSession()
  if (!session) redirect('/login')

  const type = formData.get('type')
  if (type === 'release') {
    return createReleaseDraft(session.user.id)
  }
  if (type === 'news') {
    const news = await createNewsDraft(session.user.id)
    revalidatePath('/studio/news')
    redirect(`/studio/news/${news.id}`)
  }
  redirect('/studio/new')
}

async function createReleaseDraft(userId: string) {
  const slug = generateSlug(`release-${Date.now()}`)
  const release = await dbQueryOne<{ id: string }>(
    `INSERT INTO releases (title, slug, status)
     VALUES ('Без названия', $1, 'draft'::release_status)
     RETURNING id`,
    [slug],
  )
  if (!release) redirect('/studio/new')

  await dbQueryOne(
    `INSERT INTO release_collaborators (release_id, user_id, role)
     VALUES ($1, $2, 'owner'::collaborator_role)`,
    [release.id, userId],
  )

  revalidatePath('/studio')
  redirect(`/studio/releases/${release.id}`)
}
