import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminSession } from '@/lib/server/studio-auth'
import { createPasswordUser, listAdminUsers, normalizeLogin } from '@/lib/server/users'
import { apiHandler } from '@/lib/api-handler'
import { normalizeRoles } from '@/lib/api/normalizers'

export const dynamic = 'force-dynamic'

async function getAdminUsers(_request: NextRequest) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await listAdminUsers()
  return NextResponse.json(users)
}

async function createAdminUser(request: NextRequest) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const login = normalizeLogin(body.login)
  const password = typeof body.password === 'string' ? body.password : ''
  const displayName =
    typeof body.display_name === 'string' && body.display_name.trim()
      ? body.display_name.trim()
      : login

  if (!login || login.length < 3 || password.length < 6) {
    return NextResponse.json(
      { error: 'Login must be at least 3 chars and password at least 6 chars' },
      { status: 400 },
    )
  }

  const user = await createPasswordUser({
    login,
    password,
    displayName,
    roles: normalizeRoles(body.roles),
  })

  return NextResponse.json(user, { status: 201 })
}

export const GET = apiHandler(getAdminUsers)
export const POST = apiHandler(createAdminUser)