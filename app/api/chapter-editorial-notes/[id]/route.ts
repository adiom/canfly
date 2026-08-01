import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getUserRoles } from '@/lib/server/session'
import { deleteEditorialNote } from '@/lib/server/chapter-highlights'
import { apiHandler } from '@/lib/api-handler'

async function deleteEditorialNoteHandler(
  _request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const { id } = await context.params as { id: string }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roles = await getUserRoles(user.id)
  const isAdmin = roles.includes('admin')
  const canEdit = isAdmin || roles.includes('editor') || roles.includes('author')
  if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const deleted = await deleteEditorialNote(id, user.id, isAdmin)
  if (!deleted) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json({ data: { id } })
}

export const DELETE = apiHandler(deleteEditorialNoteHandler)
