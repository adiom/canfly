import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // --- next-auth роуты — пропускаем ---
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/magic') ||
    pathname.startsWith('/hi/')
  ) {
    return NextResponse.next()
  }

  // --- Защита /profile через next-auth JWT ---
  if (pathname.startsWith('/profile')) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    })

    if (!token) {
      // console.log(`[proxy] /profile redirect to /login — no token for path: ${pathname}`)
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    // console.log(`[proxy] /profile allowed`, { userId: token.sub, roles: token.roles })
    return NextResponse.next({ request })
  }

  // --- Защита /admin — требуется роль admin ---
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    })

    if (!token) {
      // console.log(`[proxy] /admin redirect to /login — no token for path: ${pathname}`)
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    const roles = (token?.roles as string[]) || []
    if (!roles.includes('admin')) {
      // console.log(`[proxy] /admin access denied`, { userId: token.sub, roles })
      // Авторизован, но не админ — показываем страницу с объяснением, а не тихий редирект
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }

    // console.log(`[proxy] /admin allowed`, { userId: token.sub })
    return NextResponse.next({ request })
  }

  // --- Защита /studio — требуется авторизация (роль проверяется в layout через DB) ---
  if (pathname.startsWith('/studio') && pathname !== '/studio-access-denied') {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    })

    if (!token) {
      // console.log(`[proxy] /studio redirect to /login — no token for path: ${pathname}`)
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    // console.log(`[proxy] /studio authenticated`, { userId: token.sub })
    return NextResponse.next({ request })
  }

  // --- Редирект /release → /releases (каталог) ---
  if (pathname === '/release') {
    return NextResponse.redirect(new URL('/releases/', request.url), 301)
  }

  // --- Lowercase slug для /release/[slug]/... ---
  if (pathname.startsWith('/release/')) {
    const segments = pathname.split('/')
    const slug = segments[2]
    if (slug && slug !== slug.toLowerCase()) {
      segments[2] = slug.toLowerCase()
      const url = request.nextUrl.clone()
      url.pathname = segments.join('/')
      return NextResponse.redirect(url, 301)
    }
  }

  // --- Редиректы со старой системы книг на Release ---
  if (pathname === '/books') {
    return NextResponse.redirect(new URL('/releases/', request.url))
  }

  if (pathname.startsWith('/books/')) {
    // /books/[slug]/[chapter] или /books/[slug]/full -> /release/[slug]
    const slug = pathname.split('/')[2].toLowerCase()
    return NextResponse.redirect(new URL(`/release/${slug}`, request.url))
  }

  // --- Редиректы Shop/Cart на Release ---
  if (pathname.startsWith('/shop') || pathname.startsWith('/cart')) {
    return NextResponse.redirect(new URL('/releases/', request.url))
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    '/profile/:path*',
    '/admin/:path*',
    '/studio/:path*',
    '/release',
    '/release/:path*',
    '/books/:path*',
    '/shop/:path*',
    '/cart/:path*',
  ],
}
