'use server'

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/server/session'
import {
  issueMcpAuthorizationCode,
  logMcpOAuthEvent,
  mcpAuthorizationRedirect,
  mcpOAuthUserAllowed,
  validateMcpAuthorization,
  verifyMcpAuthorizationRequest,
} from '@/lib/server/mcp-oauth'
import type { McpAuthorization } from '@/lib/schemas/mcp-oauth'

function authorizePath(request: McpAuthorization): string {
  const params = new URLSearchParams({
    response_type: request.response_type,
    client_id: request.client_id,
    redirect_uri: request.redirect_uri,
    code_challenge: request.code_challenge,
    code_challenge_method: request.code_challenge_method,
    state: request.state,
  })
  if (request.resource) params.set('resource', request.resource)
  if (request.scope) params.set('scope', request.scope)
  return `/oauth/mcp/authorize?${params.toString()}`
}

/**
 * Подтверждение или отказ на странице согласия. Параметры приходят только в
 * подписанном виде: открытые query-параметры формы можно подменить, подпись —
 * нет. Роль и allowlist перепроверяются здесь, а не только при показе страницы.
 */
export async function consentMcpAuthorization(formData: FormData): Promise<never> {
  const signed = formData.get('request')
  const decision = formData.get('decision')

  if (typeof signed !== 'string') {
    redirect('/oauth/mcp/authorize?error=invalid_request')
  }

  const verified = verifyMcpAuthorizationRequest(signed)
  if (!verified) {
    redirect('/oauth/mcp/authorize?error=invalid_request')
  }

  const { exp: _exp, ...request } = verified

  const user = await getCurrentUser()
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(authorizePath(request))}`)
  }

  if (!mcpOAuthUserAllowed(user)) {
    await logMcpOAuthEvent('authorize_denied', { userId: user.id })
    redirect('/oauth/mcp/authorize?error=forbidden')
  }

  const validated = await validateMcpAuthorization(request)
  if (!validated) {
    redirect('/oauth/mcp/authorize?error=invalid_request')
  }

  if (decision !== 'allow') {
    await logMcpOAuthEvent('authorize_denied', {
      clientId: validated.client.id,
      userId: user.id,
    })
    redirect(mcpAuthorizationRedirect(validated.request, {
      error: 'access_denied',
      error_description: 'Пользователь отклонил доступ',
    }))
  }

  const code = await issueMcpAuthorizationCode({
    request: validated.request,
    client: validated.client,
    userId: user.id,
  })

  if (!code) {
    redirect(mcpAuthorizationRedirect(validated.request, {
      error: 'access_denied',
      error_description: 'Аккаунт больше не имеет доступа к MCP',
    }))
  }

  redirect(mcpAuthorizationRedirect(validated.request, { code }))
}
