import { dbQuery, dbQueryOne } from '@/lib/db'

interface MagicTokenData {
  email: string
  userId: string
}

/** Сколько неудачных попыток ввода кода допускается на один email */
export const MAX_MAGIC_ATTEMPTS = 5

interface ConsumeOptions {
  /**
   * Email, введённый пользователем вместе с кодом. Сверяется внутри SQL —
   * иначе подбор идёт против всего пула активных токенов, а не против одного
   * адреса. Для входа по ссылке не нужен: там токен длинный.
   */
  expectedEmail?: string
  /** true — искать по link_token (вход по ссылке), иначе по 8-значному коду */
  byLink?: boolean
}

/**
 * Проверяет и **гасит** magic-токен. Единственная точка, где токен превращается
 * в право на сессию: вызывается только из Credentials.authorize.
 *
 * Погашение атомарное — used выставляется тем же запросом, который проверяет
 * условия. Раньше между SELECT и UPDATE было окно, в которое пролезали два
 * параллельных запроса с одним кодом.
 */
export async function validateAndConsumeMagicToken(
  token: string,
  options: ConsumeOptions = {},
): Promise<MagicTokenData | null> {
  if (!token) return null

  const { expectedEmail, byLink = false } = options
  const column = byLink ? 'link_token' : 'token'

  const record = await dbQueryOne<{ email: string }>(
    `UPDATE magic_tokens
        SET used = true
      WHERE ${column} = $1
        AND used = false
        AND expires_at > NOW()
        AND attempts < ${MAX_MAGIC_ATTEMPTS}
        AND ($2::text IS NULL OR email = $2)
      RETURNING email`,
    [token, expectedEmail ?? null],
  )

  if (!record) {
    // Промах по коду — засчитываем попытку всем активным токенам этого email.
    // Без email (вход по ссылке) считать нечего: там подбор нереален.
    if (expectedEmail) {
      await dbQuery(
        `UPDATE magic_tokens
            SET attempts = attempts + 1
          WHERE email = $1
            AND used = false
            AND expires_at > NOW()`,
        [expectedEmail],
      )
    }
    return null
  }

  const { email } = record

  let existing = await dbQueryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 LIMIT 1',
    [email],
  )

  if (!existing) {
    const handle = `user-${crypto.randomUUID().slice(0, 8)}`
    const created = await dbQueryOne<{ id: string }>(
      `INSERT INTO users (email, handle, display_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email, handle, handle],
    )
    if (!created) return null
    existing = created
  }

  return { email, userId: existing.id }
}
