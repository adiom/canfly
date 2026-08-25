'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireStudioAdminSession } from '@/lib/server/studio-auth'
import {
  countActiveAdmins,
  createPasswordUser,
  normalizeLogin,
  setAdminStatus,
  setPublicRole,
  setSystemRoles,
  softDeleteUser,
  updateUserPassword,
} from '@/lib/server/users'
import type { PublicRole, SystemRole } from '@/lib/types'

type ActionResponse = { error: string } | { ok: true }

async function requireAdmin() {
  const session = await requireStudioAdminSession()
  if (!session) redirect('/admin/login')
  return session
}

const PUBLIC_ROLES: PublicRole[] = ['reader', 'author']

const createUserSchema = z.object({
  login: z.string().min(3, 'Логин не короче 3 символов').max(40),
  password: z.string().min(6, 'Пароль не короче 6 символов'),
  display_name: z.string().min(1, 'Имя обязательно').max(80),
})

export async function createUserAction(formData: FormData): Promise<ActionResponse> {
  await requireAdmin()

  const result = createUserSchema.safeParse(Object.fromEntries(formData))
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Некорректные данные' }
  }

  const login = normalizeLogin(result.data.login)
  if (!login) return { error: 'Логин содержит только a-z, 0-9, _, ., -' }

  try {
    await createPasswordUser({
      login,
      password: result.data.password,
      displayName: result.data.display_name,
      publicRole: 'reader',
      isAdmin: false,
    })
  } catch {
    return { error: 'Не удалось создать пользователя (логин занят?)' }
  }

  revalidatePath('/admin')
  return { ok: true }
}

export async function setUserPublicRoleAction(
  userId: string,
  publicRole: PublicRole,
): Promise<ActionResponse> {
  await requireAdmin()
  if (!PUBLIC_ROLES.includes(publicRole)) return { error: 'Недопустимая публичная роль' }

  await setPublicRole(userId, publicRole)
  revalidatePath('/admin')
  return { ok: true }
}

export async function toggleAdminAction(userId: string, makeAdmin: boolean): Promise<ActionResponse> {
  await requireAdmin()

  if (!makeAdmin) {
    const admins = await countActiveAdmins(userId)
    if (admins <= 1) return { error: 'Нельзя снять последнего администратора' }
  }

  await setAdminStatus(userId, makeAdmin)
  revalidatePath('/admin')
  return { ok: true }
}

export async function toggleEditorRoleAction(userId: string, roles: SystemRole[]): Promise<ActionResponse> {
  await requireAdmin()
  await setSystemRoles(userId, roles)
  revalidatePath('/admin')
  return { ok: true }
}

export async function changeUserPasswordAction(userId: string, password: string): Promise<ActionResponse> {
  await requireAdmin()
  if (password.length < 6) return { error: 'Пароль не короче 6 символов' }

  await updateUserPassword(userId, password)
  return { ok: true }
}

export async function deleteUserAction(userId: string): Promise<ActionResponse> {
  await requireAdmin()
  await softDeleteUser(userId)
  revalidatePath('/admin')
  return { ok: true }
}
