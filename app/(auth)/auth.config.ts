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

async function findOrCreateUserByEmail(email: string, name?: string | null): Promise<UserProfile | null> {
  const existing = await dbQueryOne<UserProfile>(
    'SELECT * FROM users WHERE email = $1 LIMIT 1',
    [email],
  )

  if (existing) return existing

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

      console.log('[auth] signIn', {
        provider,
        userEmail: user?.email,
        userName: user?.name,
        userId: user?.id,
        isLinking,
        profileData: provider !== 'credentials' ? { email: profile?.email, name: profile?.name } : undefined,
      })

      if (account?.provider !== 'credentials') {
        if (!account) return false

        if (!user?.email) {
          console.warn('[auth] signIn rejected: no email', {
            provider,
            user,
            profile,
          })
          return false
        }

        try {
          // Если это режим привязки — привязываем к текущему пользователю из JWT
          if (isLinking) {
            if (!request) {
              console.warn('[auth] signIn linking rejected: no request context')
              return '/profile/settings?link_error=session'
            }

            const currentToken = await getToken({
              req: request,
              secret: process.env.AUTH_SECRET,
            })
            const currentUserId = currentToken?.id

            if (!currentUserId) {
              console.warn('[auth] signIn linking rejected: no current user in session')
              return '/profile/settings?link_error=session'
            }

            const providerAccountId = account.providerAccountId

            // Проверяем, не привязан ли уже такой аккаунт
            const existingLink = await dbQueryOne<{ id: string }>(
              'SELECT id FROM linked_accounts WHERE provider = $1 AND provider_account_id = $2 LIMIT 1',
              [provider, providerAccountId],
            )
            if (!existingLink) {
              const profileName = (profile as { name?: string | null })?.name ?? user.name ?? null
              const profileImage = (profile as { image?: string | null })?.image ?? (profile as { picture?: string | null })?.picture ?? null

              await dbQueryOne(
                `INSERT INTO linked_accounts (user_id, provider, provider_account_id, display_name, avatar_url)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (provider, provider_account_id) DO NOTHING`,
                [currentUserId, provider, providerAccountId, profileName, profileImage],
              )
            }
            console.log('[auth] signIn linked', { provider, currentUserId, linkedTo: providerAccountId })

            return `/profile/settings?linked=${provider}`
          }

          // Обычный OAuth-вход: ищем/создаём пользователя по email
          const dbUser = await findOrCreateUserByEmail(user.email, user.name)
          if (!dbUser) {
            console.warn('[auth] signIn rejected: user not created', { email: user.email })
            return false
          }

          user.id = dbUser.id
          ;(user as { type: UserType }).type = 'regular'
          ;(user as { handle?: string | null }).handle = dbUser.handle
          ;(user as { login?: string | null }).login = dbUser.login

          // Автоматически привязываем OAuth-аккаунт к найденному пользователю
          const providerAccountId = account.providerAccountId
          const existingLink = await dbQueryOne<{ id: string }>(
            'SELECT id FROM linked_accounts WHERE provider = $1 AND provider_account_id = $2 LIMIT 1',
            [provider, providerAccountId],
          )
          if (!existingLink) {
            const profileName = (profile as { name?: string | null })?.name ?? user.name ?? null
            const profileImage = (profile as { image?: string | null })?.image ?? (profile as { picture?: string | null })?.picture ?? null

            await dbQueryOne(
              `INSERT INTO linked_accounts (user_id, provider, provider_account_id, display_name, avatar_url)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (provider, provider_account_id) DO NOTHING`,
              [dbUser.id, provider, providerAccountId, profileName, profileImage],
            )
          }

          console.log('[auth] signIn success', { provider, userId: dbUser.id, email: user.email })
          return true
        } catch (error) {
          console.error('[auth] signIn OAuth failed', {
            provider,
            email: user.email,
            error: error instanceof Error ? error.message : String(error),
          })
          return false
        }
      }

      console.log('[auth] signIn credentials success', { userId: user?.id })
      return true
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        console.log('[auth] jwt update', {
          trigger,
          userId: user.id,
          userType: (user as { type?: UserType }).type,
        })
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
          console.log('[auth] jwt roles fetched', { userId: uid, roles: token.roles })
        } catch (error) {
          console.error('[auth] jwt role fetch failed', {
            userId: uid,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      if (!token.roles) token.roles = []

      return token
    },

    session({ session, token }) {
      if (session.user) {
        // console.log('[auth] session', {
        //   userId: token.id ?? token.sub,
        //   roles: token.roles,
        // })
        if (token.id) session.user.id = token.id
        session.user.type = (token.type as UserType) ?? 'regular'
        session.user.handle = token.handle ?? null
        session.user.login = token.login ?? null
        session.user.roles = token.roles as string[] ?? []
      }

      return session
    },

    async redirect({ url, baseUrl }) {
      return url.startsWith(baseUrl) ? url : baseUrl
    },
  },
  debug: false,
  }
}

export const authConfig = createAuthConfig()
