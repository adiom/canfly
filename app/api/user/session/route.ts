import { NextResponse } from 'next/server'
import { getCurrentUser, getSystemRoles } from '@/lib/server/session'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({
        user: null,
        publicRole: null,
        isAdmin: false,
        roles: [],
        isAuthenticated: false,
      })
    }

    const roles = await getSystemRoles(user.id)

    return NextResponse.json({
      user,
      publicRole: user.public_role,
      isAdmin: user.is_admin,
      roles,
      isAuthenticated: true,
    })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json({
      user: null,
      publicRole: null,
      isAdmin: false,
      roles: [],
      isAuthenticated: false,
    })
  }
}
