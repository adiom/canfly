import { NextResponse } from 'next/server'

/** OAuth-эндпоинты принимают form-urlencoded (стандарт) и JSON (отладка). */
export async function readOAuthBody(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase()

  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await request.formData()
      const result: Record<string, string> = {}
      for (const [key, value] of form.entries()) {
        if (typeof value === 'string') result[key] = value
      }
      return result
    }

    if (contentType.includes('application/json')) {
      const json: unknown = await request.json()
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        return json as Record<string, unknown>
      }
    }
  } catch {
    return null
  }

  return null
}

export function oauthError(
  error: string,
  description?: string,
  status = 400,
): NextResponse {
  console.warn(`[mcp-oauth] request rejected error=${error} status=${status}`)
  return NextResponse.json(
    description ? { error, error_description: description } : { error },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    },
  )
}

export function oauthJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  })
}
