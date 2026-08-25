'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import type { AdminUserProfile, PublicRole, SystemRole } from '@/lib/types'
import {
  changeUserPasswordAction,
  createUserAction,
  deleteUserAction,
  setUserPublicRoleAction,
  toggleAdminAction,
  toggleEditorRoleAction,
} from '@/lib/actions/admin-users'

const PUBLIC_ROLE_LABELS: Record<PublicRole, string> = {
  reader: 'Читатель',
  author: 'Автор',
}

interface AdminUsersPanelProps {
  users: AdminUserProfile[]
}

export function AdminUsersPanel({ users }: AdminUsersPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [newUser, setNewUser] = useState({ login: '', password: '', display_name: '' })
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({})

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const formData = new FormData(event.currentTarget)
    const result = await createUserAction(formData)
    if ('error' in result && result.error) {
      setError(result.error)
      return
    }

    setNewUser({ login: '', password: '', display_name: '' })
    refresh()
  }

  async function setPublicRole(user: AdminUserProfile, publicRole: PublicRole) {
    setError('')
    const result = await setUserPublicRoleAction(user.id, publicRole)
    if ('error' in result && result.error) setError(result.error)
    refresh()
  }

  async function toggleAdmin(user: AdminUserProfile) {
    setError('')
    const result = await toggleAdminAction(user.id, !user.is_admin)
    if ('error' in result && result.error) setError(result.error)
    refresh()
  }

  async function toggleEditor(user: AdminUserProfile) {
    setError('')
    const roles: SystemRole[] = user.system_roles.includes('editor')
      ? user.system_roles.filter((role) => role !== 'editor')
      : [...user.system_roles, 'editor']
    await toggleEditorRoleAction(user.id, roles)
    refresh()
  }

  async function changePassword(user: AdminUserProfile) {
    setError('')
    const password = passwordDrafts[user.id] || ''
    const result = await changeUserPasswordAction(user.id, password)
    if ('error' in result && result.error) {
      setError(result.error)
      return
    }
    setPasswordDrafts((current) => ({ ...current, [user.id]: '' }))
  }

  async function deleteUser(user: AdminUserProfile) {
    if (!window.confirm(`Скрыть пользователя «${user.display_name}»? Запись останется в БД.`)) {
      return
    }

    setError('')
    const result = await deleteUserAction(user.id)
    if ('error' in result && result.error) setError(result.error)
    refresh()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white">Пользователи и роли</h2>
      <p className="mt-1 text-sm text-slate-400">
        Пользователь входит по login/password. Пароль меняет только админ.
      </p>

      {error ? (
        <div className="mb-6 mt-4 rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mb-8 mt-6 rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h3 className="mb-4 text-lg font-bold text-white">Создать пользователя</h3>
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            name="login"
            value={newUser.login}
            onChange={(event) => setNewUser((current) => ({ ...current, login: event.target.value }))}
            placeholder="login"
            className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
          />
          <input
            name="display_name"
            value={newUser.display_name}
            onChange={(event) => setNewUser((current) => ({ ...current, display_name: event.target.value }))}
            placeholder="имя"
            className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
          />
          <input
            name="password"
            value={newUser.password}
            onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
            placeholder="пароль"
            type="password"
            className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
          />
          <Button type="submit" disabled={pending} className="bg-purple-600 hover:bg-purple-700">
            Создать
          </Button>
        </form>
      </div>

      <div className="space-y-4">
        {users.length > 0 ? (
          users.map((user) => (
            <div key={user.id} className="rounded-lg border border-slate-700 bg-slate-800 p-6">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">{user.display_name}</h3>
                  <p className="text-sm text-slate-400">
                    {user.login ? `login: ${user.login}` : `@${user.handle}`} • друзей: {user.friends_count} • диалогов: {user.conversations_count}
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {new Date(user.created_at).toLocaleDateString('ru-RU')}
                </p>
              </div>

              <div className="mb-5 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-700 bg-slate-950 p-1">
                  {(Object.keys(PUBLIC_ROLE_LABELS) as PublicRole[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      disabled={pending}
                      onClick={() => setPublicRole(user, role)}
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                        user.public_role === role
                          ? 'border border-purple-400 bg-purple-950/50 text-purple-200'
                          : 'border border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      {PUBLIC_ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggleAdmin(user)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                    user.is_admin
                      ? 'border-red-400 bg-red-950/50 text-red-200'
                      : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  admin
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggleEditor(user)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                    user.system_roles.includes('editor')
                      ? 'border-purple-400 bg-purple-950/50 text-purple-200'
                      : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  editor
                </button>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-700 pt-4 md:flex-row md:items-center">
                <input
                  value={passwordDrafts[user.id] || ''}
                  onChange={(event) =>
                    setPasswordDrafts((current) => ({ ...current, [user.id]: event.target.value }))
                  }
                  placeholder="новый пароль"
                  type="password"
                  className="h-10 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                />
                <Button type="button" variant="outline" disabled={pending} onClick={() => changePassword(user)}>
                  Сменить пароль
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  className="text-red-400 hover:text-red-300"
                  onClick={() => deleteUser(user)}
                >
                  Удалить
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-slate-400">Пользователей пока нет</div>
        )}
      </div>

      <div className="mt-10 text-center">
        <Link href="/" className="text-xs uppercase tracking-[0.18em] text-slate-500 hover:text-slate-300">
          ← На главную
        </Link>
      </div>
    </div>
  )
}
