import type { DefaultSession, NextAuthConfig } from 'next-auth'
import type { DefaultJWT } from 'next-auth/jwt'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'
import Credentials from 'next-auth/providers/credentials'
import Yandex from 'next-auth/providers/yandex'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import Twitter from 'next-auth/providers/twitter'

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
      publicRole?: string
      isAdmin?: boolean
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
    publicRole?: string
    isAdmin?: boolean
    roles?: string[]
  }
}

function findUserByEmail(email: string): Promise<UserProfile | null> {
  return dbQueryOne<UserProfile>(
    'SELECT * FROM users WHERE email = $1 LIMIT 1',
    [email],
  )
}

async function createUserWithReaderRole(email: string | null, name?: string | null): Promise<UserProfile | null> {
  const handle = `user-${crypto.randomUUID().slice(0, 8)}`
  return dbQueryOne<UserProfile>(
    `INSERT INTO users (email, handle, display_name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [email, handle, name ?? handle],
  )
}

function linkOAuthAccount(
  userId: string,
  provider: string,
  providerAccountId: string,
  displayName: string | null,
  avatarUrl: string | null,
  url: string | null,
): Promise<unknown> {
  return dbQueryOne(
    `INSERT INTO linked_accounts (user_id, provider, provider_account_id, display_name, avatar_url, url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (provider, provider_account_id) DO NOTHING`,
    [userId, provider, providerAccountId, displayName, avatarUrl, url],
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

/**
 * Публичный URL профиля провайдера — показывается на странице автора как
 * соцсеть и уходит в Person.sameAs. Провайдеры без публичного профиля
 * (yandex, google) дают null.
 */
function oauthProfileUrl(
  provider: string,
  profile: unknown,
  user: { login?: string | null },
): string | null {
  if (provider === 'twitter') {
    const username = (profile as { data?: { username?: string } } | null | undefined)?.data?.username
    return username ? `https://x.com/${username}` : null
  }
  if (provider === 'github') {
    const login = (profile as { login?: string } | null | undefined)?.login ?? user.login
    return login ? `https://github.com/${login}` : null
  }
  return null
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
            profile(profile) {
              return {
                id: profile.id.toString(),
                name: profile.name ?? profile.login,
                email: profile.email,
                image: profile.avatar_url,
                login: profile.login,
                type: 'regular' as UserType,
              }
            },
          }),
        ]
      : []),

    ...(process.env.AUTH_TWITTER_CLIENT_ID && process.env.AUTH_TWITTER_CLIENT_SECRET
      ? [
          Twitter({
            clientId: process.env.AUTH_TWITTER_CLIENT_ID,
            clientSecret: process.env.AUTH_TWITTER_CLIENT_SECRET,
            // Twitter OAuth 2.0 не отдаёт email без user.fields=email в userinfo.
            userinfo: 'https://api.x.com/2/users/me?user.fields=profile_image_url,email',
            profile(profile) {
              return {
                id: profile.data.id,
                name: profile.data.name,
                email: profile.data.email ?? null,
                image: profile.data.profile_image_url,
                login: profile.data.username,
                type: 'regular' as UserType,
              }
            },
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

        const providerAccountId = account.providerAccountId
        const profileName = (profile as { name?: string | null })?.name ?? user.name ?? null
        const profileImage =
          (profile as { image?: string | null })?.image ??
          (profile as { picture?: string | null })?.picture ??
          null
        const profileUrl = oauthProfileUrl(provider, profile, user)

        try {
          // Если это режим привязки — привязываем к текущему пользователю из JWT.
          // Email не участвует: аккаунт цепляется по provider_account_id, поэтому
          // проверка ниже (для входа) здесь не нужна.
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

            await linkOAuthAccount(currentUserId, provider, providerAccountId, profileName, profileImage, profileUrl)

            return `/profile/settings?linked=${provider}`
          }

          // Обычный OAuth-вход. Основной ключ — provider_account_id, а не email:
          // GitHub и Yandex не отдают email_verified, поэтому вход по чужому
          // (непроверенному) адресу иначе отдавал бы чужой аккаунт целиком.
          // Twitter OAuth 2.0 может не отдать email вовсе — такой вход допустим:
          // пользователь создаётся без адреса и входит только этим провайдером.
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
            if (user.email) {
              const byEmail = await findUserByEmail(user.email)

              if (byEmail && !hasVerifiedEmail(provider, profile)) {
                // Аккаунт с таким адресом уже есть, а провайдер подтверждение
                // не прислал. Привязать можно только осознанно — из настроек,
                // уже будучи внутри аккаунта (ветка isLinking выше).
                console.warn('[auth] signIn rejected: unverified email would merge accounts', { provider })
                return '/login?error=link_required'
              }

              dbUser = byEmail ?? (await createUserWithReaderRole(user.email, user.name))
            } else {
              dbUser = await createUserWithReaderRole(null, user.name)
            }

            if (dbUser) {
              await linkOAuthAccount(dbUser.id, provider, providerAccountId, profileName, profileImage, profileUrl)
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
          token.roles = rows
            .map(r => r.role)
            .filter((role): role is string => role === 'editor')

          const profile = await dbQueryOne<{ public_role: string; is_admin: boolean }>(
            'SELECT public_role, is_admin FROM users WHERE id = $1 LIMIT 1',
            [uid],
          )
          token.publicRole = profile?.public_role ?? 'reader'
          token.isAdmin = profile?.is_admin ?? false
        } catch (error) {
          console.error('[auth] jwt role fetch failed', {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      if (!token.roles) token.roles = []
      token.publicRole = token.publicRole ?? 'reader'
      token.isAdmin = token.isAdmin ?? false

      return token
    },

    session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = token.id
        session.user.type = (token.type as UserType) ?? 'regular'
        session.user.handle = token.handle ?? null
        session.user.login = token.login ?? null
        session.user.publicRole = token.publicRole ?? 'reader'
        session.user.isAdmin = token.isAdmin ?? false
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
