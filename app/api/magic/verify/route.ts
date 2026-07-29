import { type NextRequest, NextResponse } from 'next/server'

// Легаси-точка входа по ссылке. Токен здесь больше не проверяется и не гасится
// — это делает Credentials.authorize. Роут остался только чтобы старые письма
// со ссылками /api/magic/verify?token=... продолжали работать.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')?.trim()

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url))
  }

  return NextResponse.redirect(new URL(`/hi/${encodeURIComponent(token)}`, request.url))
}
