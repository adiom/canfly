import type { DefaultSession, NextAuthConfig } from 'next-auth'
import type { DefaultJWT } from 'next-auth/jwt'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'
import Credentials from 'next-auth/providers/credentials'
import Yandex from 'next-auth/providers/yandex'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'

import { dbQuery, dbQueryOne } from '@/lib/db'
import { validateAndConsumeMagicToken } from '@/lib/server/magic-token'
import type { UserProfile } from '@/lib/types'

export type UserType = 'regular'

interface CanflyOidcProfile {
  sub: string
  email?: string | null
  name?: string | null
  picture?: string | null
  handle?: string | null
  login?: string | null
}

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string
      type: UserType
      login?: string | null
      handle?: string | null
      roles?: string[]
    } & DefaultSession['user']
  }

  interface User {
    id?: string
    email?: string | null
    type: UserType
    login?: string | null
    handle?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    type: UserType
    login?: string | null
    handle?: string | null
    roles?: string[]
  }
}

function findUserByEmail(email: string): Promise<UserProfile | null> {
  return dbQueryOne<UserProfile>(
    'SELECT * FROM users WHERE email = $1 LIMIT 1',
    [email],
  )
}

async function createUserWithReaderRole(email: string, name?: string | null): Promise<UserProfile | null> {
  const handle = `user-${crypto.randomUUID().slice(0, 8)}`
  const created = await dbQueryOne<UserProfile>(
    `INSERT INTO users (email, handle, display_name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [email, handle, name ?? handle],
  )

  if (created) {
    await dbQueryOne(
      `INSERT INTO user_roles (user_id, role)
       VALUES ($1, 'reader')
       ON CONFLICT DO NOTHING`,
      [created.id],
    )
  }

  return created
}

function linkOAuthAccount(
  userId: string,
  provider: string,
  providerAccountId: string,
  displayName: string | null,
  avatarUrl: string | null,
): Promise<unknown> {
  return dbQueryOne(
    `INSERT INTO linked_accounts (user_id, provider, provider_account_id, display_name, avatar_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (provider, provider_account_id) DO NOTHING`,
    [userId, provider, providerAccountId, displayName, avatarUrl],
  )
}

/**
 * Провайдеры, чьему email доверяем без claim'а `email_verified`
 * (список через запятую в `AUTH_TRUSTED_EMAIL_PROVIDERS`). Послабление на
 * случай, когда владелец инстанса осознанно принимает риск: по умолчанию
 * пусто, и слияние с существующим аккаунтом требует подтверждённого адреса.
 */
const trustedEmailProviders = new Set(
  (process.env.AUTH_TRUSTED_EMAIL_PROVIDERS ?? '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean),
)

/**
 * Подтверждён ли адрес на стороне провайдера. Google и OIDC отдают
 * `email_verified`, а GitHub и Yandex — нет: `providers/github.js` берёт
 * primary-email игнорируя его `verified`, `providers/yandex.js` отдаёт
 * `default_email` вообще без признака подтверждения.
 */
function hasVerifiedEmail(provider: string, profile: unknown): boolean {
  if (trustedEmailProviders.has(provider)) return true
  return (profile as { email_verified?: unknown } | null | undefined)?.email_verified === true
}

const canflyIssuer = process.env.AUTH_CANFLY_ISSUER?.replace(/\/$/, '')
const canflyWellKnown =
  process.env.AUTH_CANFLY_WELL_KNOWN ??
  (canflyIssuer ? `${canflyIssuer}/.well-known/openid-configuration` : undefined)

export function createAuthConfig(request?: NextRequest): NextAuthConfig {
  return {
  trustHost: true,
  pages: {
    signIn: '/login',
    newUser: '/',
  },
  providers: [
    // Magic link. Единственный фактор входа — токен: он проверяется и гасится
    // здесь же, внутри authorize. Раньше код гасился отдельно на клиенте, а
    // authorize доверял голому email из тела запроса — то есть любой POST с
    // чужим адресом выдавал полноценную сессию.
    Credentials({
      credentials: { token: {}, email: {}, via: {} },
      async authorize(credentials) {
        const rawToken = typeof credentials?.token === 'string' ? credentials.token.trim() : ''
        if (!rawToken) return null

        const rawEmail = typeof credentials?.email === 'string'
          ? credentials.email.trim().toLowerCase()
          : ''

        const data = await validateAndConsumeMagicToken(rawToken, {
          // При ручном вводе кода email — второй фактор: 8 цифр без привязки
          // к адресу подбираются против всего пула активных токенов.
          expectedEmail: rawEmail || undefined,
          byLink: credentials?.via === 'link',
        })
        if (!data) return null

        const user = await dbQueryOne<UserProfile>(
          'SELECT id, email, display_name, login, handle FROM users WHERE id = $1 LIMIT 1',
          [data.userId],
        )
        if (!user) return null

        return {
          id: user.id,
          email: user.email ?? data.email,
          name: user.display_name,
          type: 'regular' as UserType,
          login: user.login,
          handle: user.handle,
        }
      },
    }),

    ...(process.env.AUTH_YANDEX_CLIENT_ID && process.env.AUTH_YANDEX_CLIENT_SECRET
      ? [
          Yandex({
            clientId: process.env.AUTH_YANDEX_CLIENT_ID,
            clientSecret: process.env.AUTH_YANDEX_CLIENT_SECRET,
          }),
        ]
      : []),

    ...(process.env.AUTH_GOOGLE_CLIENT_ID && process.env.AUTH_GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
            clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    ...(process.env.AUTH_GITHUB_CLIENT_ID && process.env.AUTH_GITHUB_CLIENT_SECRET
      ? [
          GitHub({
            clientId: process.env.AUTH_GITHUB_CLIENT_ID,
            clientSecret: process.env.AUTH_GITHUB_CLIENT_SECRET,
            issuer: 'https://github.com/login/oauth',
          }),
        ]
      : []),


    ...(canflyIssuer &&
    canflyWellKnown &&
    process.env.AUTH_CANFLY_CLIENT_ID &&
    process.env.AUTH_CANFLY_CLIENT_SECRET
      ? [
          {
            id: 'canfly',
            name: 'canfly',
            type: 'oidc' as const,
            issuer: canflyIssuer,
            wellKnown: canflyWellKnown,
            clientId: process.env.AUTH_CANFLY_CLIENT_ID,
            clientSecret: process.env.AUTH_CANFLY_CLIENT_SECRET,
            profile(profile: CanflyOidcProfile) {
              return {
                id: profile.sub,
                email: profile.email,
                name: profile.name,
                image: profile.picture,
                type: 'regular' as UserType,
                login: profile.login,
                handle: profile.handle,
              }
            },
          },
        ]
      : []),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      const provider = account?.provider
      const isLinking = request?.cookies.get('cf_oauth_link')?.value === provider

      if (account?.provider !== 'credentials') {
        if (!account || !provider) return false

        if (!user?.email) {
          // В логах — только причина и провайдер: email, user и profile это PII.
          console.warn('[auth] signIn rejected: no email', { provider })
          return false
        }

        const providerAccountId = account.providerAccountId
        const profileName = (profile as { name?: string | null })?.name ?? user.name ?? null
        const profileImage =
          (profile as { image?: string | null })?.image ??
          (profile as { picture?: string | null })?.picture ??
          null

        try {
          // Если это режим привязки — привязываем к текущему пользователю из JWT
          if (isLinking) {
            if (!request) {
              console.warn('[auth] signIn linking rejected: no request context', { provider })
              return '/profile/settings?link_error=session'
            }

            const currentToken = await getToken({
              req: request,
              secret: process.env.AUTH_SECRET,
            })
            const currentUserId = currentToken?.id

            if (!currentUserId) {
              console.warn('[auth] signIn linking rejected: no current user in session', { provider })
              return '/profile/settings?link_error=session'
            }

            await linkOAuthAccount(currentUserId, provider, providerAccountId, profileName, profileImage)

            return `/profile/settings?linked=${provider}`
          }

          // Обычный OAuth-вход. Основной ключ — provider_account_id, а не email:
          // GitHub и Yandex не отдают email_verified, поэтому вход по чужому
          // (непроверенному) адресу иначе отдавал бы чужой аккаунт целиком.
          const existingLink = await dbQueryOne<{ user_id: string }>(
            'SELECT user_id FROM linked_accounts WHERE provider = $1 AND provider_account_id = $2 LIMIT 1',
            [provider, providerAccountId],
          )

          let dbUser: UserProfile | null = null

          if (existingLink) {
            // Связь уже есть — это и есть пользователь, email не участвует.
            dbUser = await dbQueryOne<UserProfile>(
              'SELECT * FROM users WHERE id = $1 LIMIT 1',
              [existingLink.user_id],
            )
          } else {
            const byEmail = await findUserByEmail(user.email)

            if (byEmail && !hasVerifiedEmail(provider, profile)) {
              // Аккаунт с таким адресом уже есть, а провайдер подтверждение
              // не прислал. Привязать можно только осознанно — из настроек,
              // уже будучи внутри аккаунта (ветка isLinking выше).
              console.warn('[auth] signIn rejected: unverified email would merge accounts', { provider })
              return '/login?error=link_required'
            }

            dbUser = byEmail ?? (await createUserWithReaderRole(user.email, user.name))

            if (dbUser) {
              await linkOAuthAccount(dbUser.id, provider, providerAccountId, profileName, profileImage)
            }
          }

          if (!dbUser) {
            console.warn('[auth] signIn rejected: user not resolved', { provider })
            return false
          }

          user.id = dbUser.id
          ;(user as { type: UserType }).type = 'regular'
          ;(user as { handle?: string | null }).handle = dbUser.handle
          ;(user as { login?: string | null }).login = dbUser.login

          return true
        } catch (error) {
          console.error('[auth] signIn OAuth failed', {
            provider,
            error: error instanceof Error ? error.message : String(error),
          })
          return false
        }
      }

      return true
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        if (user.id) token.id = user.id as string
        token.type = (user as { type?: UserType }).type ?? token.type ?? 'regular'
        token.handle = (user as { handle?: string | null }).handle ?? token.handle
        token.login = (user as { login?: string | null }).login ?? token.login
      }

      if (!token.type) token.type = 'regular'

      const uid = (user?.id as string | undefined) ?? token.sub
      if ((user || trigger === 'update') && uid) {
        try {
          const rows = await dbQuery<{ role: string }>(
            'SELECT role FROM user_roles WHERE user_id = $1',
            [uid],
          )
          token.roles = rows.map(r => r.role)
        } catch (error) {
          console.error('[auth] jwt role fetch failed', {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      if (!token.roles) token.roles = []

      return token
    },

    session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = token.id
        session.user.type = (token.type as UserType) ?? 'regular'
        session.user.handle = token.handle ?? null
        session.user.login = token.login ?? null
        session.user.roles = token.roles as string[] ?? []
      }

      return session
    },

    async redirect({ url, baseUrl }) {
      // Сравниваем origin, а не префикс: `startsWith(baseUrl)` пропускал
      // `https://canfly.org.example.com` (открытый редирект через ?redirect=)
      // и одновременно резал относительный `/profile`, из-за чего
      // ?redirect= после OAuth-входа терялся.
      try {
        const target = new URL(url, baseUrl)
        return target.origin === new URL(baseUrl).origin ? target.toString() : baseUrl
      } catch {
        return baseUrl
      }
    },
  },
  debug: false,
  }
}

export const authConfig = createAuthConfig()
