'use server'

import { randomBytes, randomInt } from 'node:crypto'
import { z } from 'zod'
import { dbQuery, dbQueryOne } from '@/lib/db'

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

export interface CreateMagicLinkState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data'
  message?: string
  magicLink?: string
}

export const createMagicLink = async (
  _: CreateMagicLinkState,
  formData: FormData,
): Promise<CreateMagicLinkState> => {
  try {
    const validated = emailSchema.parse({ email: formData.get('email') })
    const { email } = validated

    await dbQuery(
      `DELETE FROM magic_tokens
       WHERE email = $1 AND expires_at < NOW()`,
      [email],
    )

    const recent = await dbQueryOne<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM magic_tokens
       WHERE email = $1 AND created_at > NOW() - INTERVAL '15 minutes' AND used = false`,
      [email],
    )

    if (recent && Number(recent.cnt) >= 3) {
      return {
        status: 'failed',
        message: 'Слишком много запросов. Попробуйте через 15 минут.',
      }
    }

    // Код (8 цифр) — для ручного ввода, защищён привязкой к email и счётчиком
    // попыток. Ссылка ходит по длинному токену: 8 цифр вслепую подбираются.
    const token = randomInt(10_000_000, 100_000_000).toString()
    const linkToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    await dbQuery(
      `INSERT INTO magic_tokens (token, link_token, email, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [token, linkToken, email, expiresAt],
    )

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      'http://localhost:3000'

    const magicLinkUrl = `${baseUrl}/hi/${linkToken}`

    if (process.env.NODE_ENV === 'development') {
      console.log(`[magic-link] Код для ${email}: ${token}`)
      console.log(`[magic-link] Ссылка: ${magicLinkUrl}`)

      return {
        status: 'success',
        message: 'Код создан (смотри консоль сервера)',
        magicLink: token,
      }
    }

    // В production код не возвращается и не логируется — он уходит только
    // на почту. Раньше он лежал прямо в ответе, а UI лишь прятал его в CSS.
    return {
      status: 'success',
      message: 'Ссылка отправлена на ваш email',
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data', message: 'Некорректный email' }
    }

    console.error('[magic-link] Ошибка создания:', error)
    return { status: 'failed', message: 'Внутренняя ошибка сервера' }
  }
}
