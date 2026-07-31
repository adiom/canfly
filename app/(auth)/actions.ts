'use server'

import { randomBytes, randomInt } from 'node:crypto'
import { z } from 'zod'
import { dbQuery, dbQueryOne } from '@/lib/db'

const POSTMARK_API_URL = 'https://api.postmarkapp.com/email'

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

export interface CreateMagicLinkState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data'
  message?: string
  magicLink?: string
}

async function sendMagicLinkEmail(params: {
  email: string
  magicLinkUrl: string
  token: string
}) {
  const serverToken = process.env.POSTMARK_SERVER_TOKEN
  const fromEmail = process.env.POSTMARK_FROM_EMAIL

  if (!serverToken || !fromEmail) {
    throw new Error('Postmark env is not configured')
  }

  const subject = 'Вход или регистрация в canfly'
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1816;">
      <h1 style="font-size: 24px; margin: 0 0 16px;">Вход или регистрация в canfly</h1>
      <p style="margin: 0 0 16px;">Нажмите на кнопку ниже, чтобы войти. Если аккаунта ещё нет, он создастся автоматически.</p>
      <p style="margin: 0 0 24px;">
        <a href="${params.magicLinkUrl}"
           style="display: inline-block; background: #d52525; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 14px;">
          Войти в canfly
        </a>
      </p>
      <p style="margin: 0 0 8px; font-size: 14px; color: #6b6058;">
        Если кнопка не работает, откройте ссылку вручную:
      </p>
      <p style="margin: 0; word-break: break-all; font-size: 14px;">
        <a href="${params.magicLinkUrl}" style="color: #d52525;">${params.magicLinkUrl}</a>
      </p>
      <p style="margin: 24px 0 0; font-size: 12px; color: #8a7e74;">
        Код для ручного ввода: ${params.token}
      </p>
    </div>
  `.trim()

  const textBody = [
    'Вход или регистрация в canfly',
    '',
    `Ссылка для входа: ${params.magicLinkUrl}`,
    `Код для ручного ввода: ${params.token}`,
  ].join('\n')

  const response = await fetch(POSTMARK_API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': serverToken,
    },
    body: JSON.stringify({
      From: fromEmail,
      To: params.email,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: 'outbound',
      Tag: 'magic-link',
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Postmark send failed: ${response.status} ${details}`)
  }
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
    }

    try {
      await sendMagicLinkEmail({ email, magicLinkUrl, token })
    } catch (emailError) {
      console.error('[magic-link] Ошибка отправки email:', emailError)
      return {
        status: 'failed',
        message: 'Код создан, но письмо не удалось отправить. Попробуйте позже.',
      }
    }

    return {
      status: 'success',
      message: process.env.NODE_ENV === 'development'
        ? 'Код создан (смотри консоль) + отправлен на email'
        : 'Ссылка отправлена на ваш email',
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data', message: 'Некорректный email' }
    }

    console.error('[magic-link] Ошибка создания:', error)
    return { status: 'failed', message: 'Внутренняя ошибка сервера' }
  }
}
