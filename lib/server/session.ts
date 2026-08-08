import { auth } from '@/app/(auth)/auth'
import { dbQuery } from '@/lib/db'
import type { UserProfile, UserRole } from '@/lib/types'

export interface SessionUser {
  id: string
  email: string | null
  login: string | null
  handle: string | null
  display_name: string
  avatar: string | null
  bio: string | null
  tagline: string | null
  signature_color: string | null
  profile_is_public: boolean
  show_reading: boolean
  created_at: string
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const users = await dbQuery<UserProfile>(
    'SELECT id, email, login, handle, display_name, avatar, bio, tagline, signature_color, profile_is_public, show_reading, created_at FROM users WHERE id = $1 LIMIT 1',
    [session.user.id],
  )
  const user = users[0]
  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    login: user.login,
    handle: user.handle,
    display_name: user.display_name,
    avatar: user.avatar,
    bio: user.bio,
    tagline: user.tagline,
    signature_color: user.signature_color,
    profile_is_public: user.profile_is_public ?? true,
    show_reading: user.show_reading ?? true,
    created_at: user.created_at,
  }
}

export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const rows = await dbQuery<{ role: string }>(
    'SELECT role FROM user_roles WHERE user_id = $1',
    [userId],
  )
  return rows.map(r => r.role as UserRole)
}
