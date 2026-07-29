import { NextRequest, NextResponse } from 'next/server'

type HandlerFn = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<NextResponse>

type SimpleHandlerFn = (request: NextRequest) => Promise<NextResponse>

/** redirect()/notFound() бросают специальную ошибку с digest — её нельзя глотать */
function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown })?.digest
  return typeof digest === 'string' && (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND')
}

function logError(method: string, path: string, error: unknown) {
  const msg =
    error instanceof Error ? error.message : String(error)
  const stack =
    error instanceof Error ? error.stack : undefined
  console.error(
    `[API] ${method} ${path} → 500: ${msg}`,
    stack ? '\n' + stack : '',
  )
}

export function apiHandler(
  handler: HandlerFn | SimpleHandlerFn,
): HandlerFn {
  return async (request, context) => {
    const method = request.method
    const path = request.nextUrl.pathname
    try {
      const result = await (handler as HandlerFn)(request, context)
      if (result.status >= 500) {
        try {
          const body = await result.clone().json()
          logError(method, path, body.error ?? body)
        } catch {
          logError(method, path, `status ${result.status} (non-JSON body)`)
        }
      }
      return result
    } catch (error) {
      // redirect() из ownership-проверок — это управляющий поток, а не сбой:
      // пробрасываем, иначе он превращается в 500 с мусорным digest.
      if (isNextControlFlow(error)) throw error

      logError(method, path, error)

      // Наружу — общий текст: сообщения pg содержат имена таблиц, колонок
      // и constraint'ов. Детали остаются в логе.
      const message =
        process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : 'Internal Server Error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
}