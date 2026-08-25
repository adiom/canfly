'use server'

import { revalidatePath } from 'next/cache'
import { dbQuery, dbQueryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/server/session'

// === Types ===

export interface LinkedAccount {
  id: string
  provider: string
  provider_account_id: string
  display_name: string | null
  avatar_url: string | null
  /** Публичный URL профиля провайдера — соцсеть на странице автора. */
  url: string | null
  created_at: string
}

// === Getters ===

export async function getAccountSettings(): Promise<{ linkedAccounts: LinkedAccount[] } | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const linkedAccounts = await dbQuery<LinkedAccount>(
    `SELECT id, provider, provider_account_id, display_name, avatar_url, url, created_at
     FROM linked_accounts
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [user.id],
  )

  return { linkedAccounts }
}

// === Linked Accounts Actions ===

export async function unlinkAccount(accountId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Необходима авторизация')

  const account = await dbQueryOne<{ provider: string }>(
    'SELECT provider FROM linked_accounts WHERE id = $1 AND user_id = $2',
    [accountId, user.id],
  )
  if (!account) throw new Error('Аккаунт не найден')

  // Проверяем, не единственный ли это OAuth-аккаунт (если нет password — нельзя удалить последний)
  const count = await dbQueryOne<{ cnt: string }>(
    'SELECT COUNT(*) AS cnt FROM linked_accounts WHERE user_id = $1',
    [user.id],
  )
  const hasPassword = await dbQueryOne<{ has: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND password_hash IS NOT NULL) AS has',
    [user.id],
  )

  if (Number(count?.cnt ?? 0) <= 1 && !hasPassword?.has) {
    throw new Error('Нельзя отвязать последний внешний аккаунт (нет пароля)')
  }

  await dbQuery(
    'DELETE FROM linked_accounts WHERE id = $1 AND user_id = $2',
    [accountId, user.id],
  )

  revalidatePath('/profile/settings')
}
