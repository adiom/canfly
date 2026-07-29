'use server'

import { randomInt } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { dbQuery, dbQueryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/server/session'

// === Types ===

export interface UserEmail {
  id: string
  email: string
  is_primary: boolean
  verified: boolean
  created_at: string
}

export interface LinkedAccount {
  id: string
  provider: string
  provider_account_id: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface AccountSettings {
  emails: UserEmail[]
  linkedAccounts: LinkedAccount[]
}

// === Helpers ===

/** Сколько неудачных вводов кода допускается до инвалидации верификации */
const MAX_VERIFY_ATTEMPTS = 5

function generateVerificationCode(): string {
  // CSPRNG: Math.random() предсказуем и не годится для кодов доступа
  return randomInt(100_000, 1_000_000).toString()
}

// === Getters ===

export async function getAccountSettings(): Promise<AccountSettings | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const [emails, linkedAccounts] = await Promise.all([
    dbQuery<UserEmail>(
      `SELECT id, email, is_primary, verified, created_at
       FROM user_emails
       WHERE user_id = $1
       ORDER BY is_primary DESC, created_at ASC`,
      [user.id],
    ),
    dbQuery<LinkedAccount>(
      `SELECT id, provider, provider_account_id, display_name, avatar_url, created_at
       FROM linked_accounts
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [user.id],
    ),
  ])

  return { emails, linkedAccounts }
}

// === Email Actions ===

export async function addEmail(
  _: { status: string; message?: string },
  formData: FormData,
): Promise<{ status: string; message?: string }> {
  const user = await getCurrentUser()
  if (!user) return { status: 'error', message: 'Необходима авторизация' }

  const rawEmail = formData.get('email')?.toString().trim().toLowerCase()
  if (!rawEmail) return { status: 'error', message: 'Введите email' }

  const emailParsed = z.string().email().safeParse(rawEmail)
  if (!emailParsed.success) {
    return { status: 'error', message: 'Некорректный email' }
  }

  // Проверяем, не занят ли email другим пользователем
  const existing = await dbQueryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 AND id != $2 LIMIT 1',
    [rawEmail, user.id],
  )
  if (existing) {
    return { status: 'error', message: 'Этот email уже используется другим пользователем' }
  }

  // Проверяем, не добавлен ли уже этот email
  const alreadyAdded = await dbQueryOne<{ id: string }>(
    'SELECT id FROM user_emails WHERE user_id = $1 AND email = $2 LIMIT 1',
    [user.id, rawEmail],
  )
  if (alreadyAdded) {
    return { status: 'error', message: 'Этот email уже добавлен' }
  }

  // Проверяем лимит: не более 5 email'ов
  const count = await dbQueryOne<{ cnt: string }>(
    'SELECT COUNT(*) AS cnt FROM user_emails WHERE user_id = $1',
    [user.id],
  )
  if (count && Number(count.cnt) >= 5) {
    return { status: 'error', message: 'Максимум 5 email\'ов на аккаунт' }
  }

  // Вставляем email
  const isFirst = !count || Number(count.cnt) === 0
  const newEmail = await dbQueryOne<{ id: string }>(
    `INSERT INTO user_emails (user_id, email, is_primary, verified)
     VALUES ($1, $2, $3, false)
     RETURNING id`,
    [user.id, rawEmail, isFirst],
  )
  if (!newEmail) {
    return { status: 'error', message: 'Ошибка при добавлении email' }
  }

  // users.email синхронизируется только после подтверждения кода (см. verifyEmail):
  // это ключ идентификации при входе, и подставлять туда неподтверждённый адрес
  // значит позволять менять identity аккаунта чужой почтой.

  // Генерируем код верификации
  const code = generateVerificationCode()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 минут

  await dbQuery(
    `INSERT INTO email_verifications (user_id, email_id, code, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [user.id, newEmail.id, code, expiresAt],
  )

  if (process.env.NODE_ENV === 'development') {
    console.log(`[email-verify] Код для ${rawEmail}: ${code}`)
  }

  revalidatePath('/profile/settings')
  return { status: 'success', message: 'Код подтверждения отправлен' }
}

export async function verifyEmail(
  _: { status: string; message?: string },
  formData: FormData,
): Promise<{ status: string; message?: string }> {
  const user = await getCurrentUser()
  if (!user) return { status: 'error', message: 'Необходима авторизация' }

  const emailId = formData.get('emailId')?.toString()
  const code = formData.get('code')?.toString().trim()

  if (!emailId || !code) {
    return { status: 'error', message: 'Неверный запрос' }
  }

  // Ищем активную верификацию
  const verification = await dbQueryOne<{ id: string }>(
    `SELECT id FROM email_verifications
     WHERE user_id = $1 AND email_id = $2 AND code = $3
       AND expires_at > NOW()
       AND attempts < $4
     LIMIT 1`,
    [user.id, emailId, code, MAX_VERIFY_ATTEMPTS],
  )

  if (!verification) {
    // 6 цифр подбираются быстро — считаем неудачные попытки
    await dbQuery(
      `UPDATE email_verifications SET attempts = attempts + 1
       WHERE user_id = $1 AND email_id = $2 AND expires_at > NOW()`,
      [user.id, emailId],
    )
    return { status: 'error', message: 'Неверный или просроченный код' }
  }

  // Помечаем email как верифицированный
  const verified = await dbQueryOne<{ email: string; is_primary: boolean }>(
    `UPDATE user_emails SET verified = true
      WHERE id = $1 AND user_id = $2
      RETURNING email, is_primary`,
    [emailId, user.id],
  )

  // Только теперь адрес попадает в users.email — ключ идентификации при входе
  if (verified?.is_primary) {
    await dbQuery('UPDATE users SET email = $1 WHERE id = $2', [verified.email, user.id])
  }

  // Удаляем использованные коды
  await dbQuery(
    'DELETE FROM email_verifications WHERE user_id = $1 AND email_id = $2',
    [user.id, emailId],
  )

  revalidatePath('/profile/settings')
  return { status: 'success', message: 'Email подтверждён' }
}

export async function setPrimaryEmail(emailId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Необходима авторизация')

  const email = await dbQueryOne<{ email: string }>(
    'SELECT email FROM user_emails WHERE id = $1 AND user_id = $2 AND verified = true',
    [emailId, user.id],
  )
  if (!email) throw new Error('Email не найден или не подтверждён')

  // Снимаем primary у всех
  await dbQuery(
    'UPDATE user_emails SET is_primary = false WHERE user_id = $1',
    [user.id],
  )

  // Ставим новый primary
  await dbQuery(
    'UPDATE user_emails SET is_primary = true WHERE id = $1 AND user_id = $2',
    [emailId, user.id],
  )

  // Синхронизируем users.email
  await dbQuery(
    'UPDATE users SET email = $1 WHERE id = $2',
    [email.email, user.id],
  )

  revalidatePath('/profile/settings')
}

export async function removeEmail(emailId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Необходима авторизация')

  const email = await dbQueryOne<{ is_primary: boolean }>(
    'SELECT is_primary FROM user_emails WHERE id = $1 AND user_id = $2',
    [emailId, user.id],
  )
  if (!email) throw new Error('Email не найден')

  if (email.is_primary) {
    // Проверяем, есть ли другие verified email'ы
    const other = await dbQueryOne<{ id: string }>(
      'SELECT id FROM user_emails WHERE user_id = $1 AND id != $2 AND verified = true LIMIT 1',
      [user.id, emailId],
    )
    if (!other) {
      throw new Error('Нельзя удалить единственный подтверждённый email')
    }
    // Переключаем primary на другой verified email
    await dbQuery(
      'UPDATE user_emails SET is_primary = true WHERE id = $1',
      [other.id],
    )
    const newPrimary = await dbQueryOne<{ email: string }>(
      'SELECT email FROM user_emails WHERE id = $1',
      [other.id],
    )
    if (newPrimary) {
      await dbQuery('UPDATE users SET email = $1 WHERE id = $2', [newPrimary.email, user.id])
    }
  }

  await dbQuery(
    'DELETE FROM user_emails WHERE id = $1 AND user_id = $2',
    [emailId, user.id],
  )

  revalidatePath('/profile/settings')
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
