import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminSession } from '@/lib/server/studio-auth'
import {
  countActiveAdmins,
  fetchUserById,
  setAdminStatus,
  setPublicRole,
  setSystemRoles,
  softDeleteUser,
  updateUserPassword,
} from '@/lib/server/users'
import { getSystemRoles } from '@/lib/server/session'
import { apiHandler } from '@/lib/api-handler'
import { normalizePublicRole, normalizeRolesUpdate } from '@/lib/api/normalizers'

export const dynamic = 'force-dynamic'

async function updateAdminUser(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params as { id: string }
  const body = await request.json()
  const user = await fetchUserById(id)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (user.is_deleted) {
    return NextResponse.json({ error: 'User is deleted' }, { status: 410 })
  }

  if (typeof body.public_role !== 'undefined') {
    await setPublicRole(id, normalizePublicRole(body.public_role))
  }

  if (typeof body.is_admin === 'boolean') {
    if (!body.is_admin && user.is_admin && id !== session.user.id) {
      const remaining = await countActiveAdmins(id)
      if (remaining === 0) {
        return NextResponse.json(
          { error: 'Нельзя убрать последнего администратора' },
          { status: 400 },
        )
      }
    }
    await setAdminStatus(id, body.is_admin)
  }

  const systemRoles = normalizeRolesUpdate(body.roles)
  if (systemRoles) {
    await setSystemRoles(id, systemRoles)
  }

  if (typeof body.password === 'string' && body.password.length > 0) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 chars' }, { status: 400 })
    }

    await updateUserPassword(id, body.password)
  }

  return NextResponse.json({ ok: true })
}

async function deleteAdminUser(
  _request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params as { id: string }

  if (id === session.user.id) {
    return NextResponse.json(
      { error: 'Нельзя удалить свой аккаунт' },
      { status: 400 },
    )
  }

  const user = await fetchUserById(id)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (user.is_deleted) {
    return NextResponse.json({ error: 'User already deleted' }, { status: 410 })
  }

  if (user.is_admin) {
    const remaining = await countActiveAdmins(id)
    if (remaining === 0) {
      return NextResponse.json(
        { error: 'Нельзя удалить последнего администратора' },
        { status: 400 },
      )
    }
  }

  await softDeleteUser(id)

  return NextResponse.json({ ok: true })
}

export const PATCH = apiHandler(updateAdminUser)
export const DELETE = apiHandler(deleteAdminUser)
