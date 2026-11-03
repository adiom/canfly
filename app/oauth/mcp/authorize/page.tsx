import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  mcpOAuthEnabled,
  mcpOAuthUserAllowed,
  signMcpAuthorizationRequest,
  validateMcpAuthorization,
} from '@/lib/server/mcp-oauth'
import { getCurrentUser } from '@/lib/server/session'
import { consentMcpAuthorization } from './actions'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Подключение MCP — canfly',
  robots: { index: false, follow: false },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const AUTHORIZE_KEYS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'resource',
  'scope',
  'state',
] as const

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function buildAuthorizePath(raw: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams()
  for (const key of AUTHORIZE_KEYS) {
    const value = first(raw[key])
    if (value) params.set(key, value)
  }
  return `/oauth/mcp/authorize?${params.toString()}`
}

function originOf(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    return value
  }
}

function ErrorState({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--cf-bg)] px-4 py-16 text-[var(--cf-text-1)]">
      <section className="w-full max-w-md rounded-3xl border border-[var(--cf-air-line)] bg-[var(--cf-air-surface-2)] p-8 shadow-[var(--cf-air-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cf-accent)]">
          MCP · авторизация
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-[var(--cf-text-heading)]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--cf-text-3)]">{text}</p>
        <Link
          className="mt-6 inline-flex text-sm font-medium text-[var(--cf-accent)] underline underline-offset-4"
          href="/"
        >
          Вернуться на canfly
        </Link>
      </section>
    </main>
  )
}

export default async function McpAuthorizePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  if (!mcpOAuthEnabled()) notFound()

  const raw = await searchParams
  const error = first(raw.error)

  if (error === 'forbidden') {
    return (
      <ErrorState
        title="Нет доступа к MCP"
        text="Подключение разрешено только действующим администраторам canfly, чей email указан в MCP_OAUTH_ALLOWED_EMAILS."
      />
    )
  }
  if (error) {
    return (
      <ErrorState
        title="Запрос не принят"
        text="Параметры авторизации повреждены или устарели. Вернитесь в клиент и начните подключение заново."
      />
    )
  }

  const input = {
    response_type: first(raw.response_type),
    client_id: first(raw.client_id),
    redirect_uri: first(raw.redirect_uri),
    code_challenge: first(raw.code_challenge),
    code_challenge_method: first(raw.code_challenge_method),
    resource: first(raw.resource),
    scope: first(raw.scope),
    state: first(raw.state),
  }

  const validated = await validateMcpAuthorization(input)
  if (!validated) {
    return (
      <ErrorState
        title="Некорректный запрос"
        text="Клиент не зарегистрирован, redirect URI не разрешён или запрос не соответствует требованиям OAuth 2.1 с PKCE."
      />
    )
  }

  const user = await getCurrentUser()
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(buildAuthorizePath(raw))}`)
  }

  if (!mcpOAuthUserAllowed(user)) {
    return (
      <ErrorState
        title="Нет доступа к MCP"
        text={`Вы вошли как ${user.email ?? user.display_name}, но MCP доступен только администраторам из явного allowlist.`}
      />
    )
  }

  const signed = signMcpAuthorizationRequest(validated.request)
  if (!signed) {
    return (
      <ErrorState
        title="OAuth не настроен"
        text="Не удалось подписать запрос согласия. Проверьте AUTH_SECRET на сервере."
      />
    )
  }

  const clientOrigin = validated.client.clientUri
    ? originOf(validated.client.clientUri)
    : originOf(validated.client.clientId)
  const redirectOrigin = originOf(validated.request.redirect_uri)

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--cf-bg)] px-4 py-16 text-[var(--cf-text-1)]">
      <section className="w-full max-w-lg rounded-3xl border border-[var(--cf-air-line)] bg-[var(--cf-air-surface-2)] p-8 shadow-[var(--cf-air-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cf-accent)]">
          MCP · авторизация
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-[var(--cf-text-heading)]">
          Подключить {validated.client.name}?
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--cf-text-3)]">
          Клиент <span className="font-medium text-[var(--cf-text-2)]">{clientOrigin}</span> запрашивает
          полный доступ к контенту Studio. Он сможет читать черновики, создавать и изменять релизы,
          издания, главы, персонажей, места и серии, публиковать главы и удалять места.
        </p>

        <dl className="mt-6 space-y-3 rounded-2xl border border-[var(--cf-air-line)] bg-[var(--cf-air-surface)] p-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-[var(--cf-text-4)]">Аккаунт</dt>
            <dd className="text-right font-medium text-[var(--cf-text-2)]">
              {user.email ?? user.display_name}
              <span className="ml-2 rounded-full bg-[var(--cf-accent)]/10 px-2 py-0.5 text-xs text-[var(--cf-accent)]">
                администратор
              </span>
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-[var(--cf-text-4)]">Доступ</dt>
            <dd className="text-right font-medium text-[var(--cf-text-2)]">canfly:content</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-[var(--cf-text-4)]">Возврат</dt>
            <dd className="max-w-[60%] break-all text-right font-mono text-xs text-[var(--cf-text-2)]">
              {redirectOrigin}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs leading-5 text-[var(--cf-text-4)]">
          Не подключайте незнакомые клиенты. Отозвать доступ можно в настройках
          самого клиента — он вызовет revoke на canfly.
        </p>

        <form action={consentMcpAuthorization} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input type="hidden" name="request" value={signed} />
          <button
            type="submit"
            name="decision"
            value="allow"
            className="inline-flex flex-1 items-center justify-center rounded-full bg-[var(--cf-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--cf-accent-hover)]"
          >
            Разрешить доступ
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="inline-flex flex-1 items-center justify-center rounded-full border border-[var(--cf-text-3)]/30 px-5 py-3 text-sm font-semibold text-[var(--cf-text-2)] transition hover:border-[var(--cf-text-3)]/60"
          >
            Отклонить
          </button>
        </form>
      </section>
    </main>
  )
}
