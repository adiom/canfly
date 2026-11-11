import { createHmac, timingSafeEqual } from 'node:crypto'

export type EditorialExportFormat = 'docx' | 'md'
export const EXPORT_LINK_LIFETIME_SECONDS = 300

function signingSecret(): string {
  const secret = process.env.MCP_EXPORT_SECRET || process.env.AUTH_SECRET
  if (!secret) throw new Error('Для экспорта черновиков задайте MCP_EXPORT_SECRET или AUTH_SECRET')
  return secret
}

export function signEditionExport(
  editionId: string,
  format: EditorialExportFormat,
  expires: number,
  secret: string,
): string {
  const payload = `canfly-mcp-export:v1:${editionId}:${format}:${expires}`
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
}

export function verifyEditionExport(
  editionId: string,
  format: string | null,
  expiresText: string | null,
  signature: string | null,
  nowSeconds = Math.floor(Date.now() / 1000),
  secret = signingSecret(),
): boolean {
  if (format !== 'docx' && format !== 'md') return false
  if (!expiresText || !/^[0-9]{10,13}$/.test(expiresText)) return false
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false
  const expires = Number(expiresText)
  if (!Number.isSafeInteger(expires) || expires < nowSeconds || expires > nowSeconds + EXPORT_LINK_LIFETIME_SECONDS) {
    return false
  }
  const expected = signEditionExport(editionId, format, expires, secret)
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
}

export function createEditionExportLink(editionId: string, format: EditorialExportFormat) {
  const expires = Math.floor(Date.now() / 1000) + EXPORT_LINK_LIFETIME_SECONDS
  const signature = signEditionExport(editionId, format, expires, signingSecret())
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'
  const url = new URL(`/api/mcp/edition-export/${encodeURIComponent(editionId)}`, base)
  url.searchParams.set('format', format)
  url.searchParams.set('expires', String(expires))
  url.searchParams.set('signature', signature)
  return { url: url.toString(), expires_at: new Date(expires * 1000).toISOString() }
}
