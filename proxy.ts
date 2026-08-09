import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Куда ведут 301 со снятых разделов.
 *
 * Без завершающего слэша: `trailingSlash` в `next.config.mjs` не включён, и
 * Next добавил бы к `/releases/` ещё один 308. Адрес намеренно захардкожен, а
 * не берётся из `CATALOG_PATH`: редирект постоянный, а каталог может переехать —
 * пусть тогда сам `/releases` и отвечает за следующий прыжок.
 */
const CATALOG = '/releases'

/**
 * Файловые конвенции метаданных Next (`opengraph-image.tsx` рядом с `page.tsx`)
 * дают вложенные URL: `/release/[slug]/opengraph-image`, с суффиксом при
 * нескольких файлах в сегменте и с id при `generateImageMetadata`. Для правила
 * «всё глубже /release/[slug] — на сам релиз» это подмаршрут, поэтому картинка
 * отвечала 301 и unfurl в мессенджерах оставался пустым.
 *
 * Два сегмента в начале обязательны: иначе выражение съело бы сам релиз со
 * слагом `icon` или `icon-…` и увело его мимо нормализации.
 */
const METADATA_ROUTE =
  /^\/[^/]+\/[^/]+\/(opengraph-image|twitter-image|apple-icon|icon)(-\w+)?(\/|$)/

function readToken(request: NextRequest) {
  return getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  })
}

/** Страница входа с адресом возврата. */
function toLogin(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('redirect', pathname)
  return NextResponse.redirect(url)
}

function permanent(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url), 301)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (METADATA_ROUTE.test(pathname)) {
    return NextResponse.next()
  }

  // --- Лендинг живёт на корне; /home остался от прежней раскладки ---
  if (pathname === '/home' || pathname.startsWith('/home/')) {
    return permanent(request, '/')
  }

  // --- Защита /profile через next-auth JWT ---
  if (
    pathname === '/user' ||
    pathname.startsWith('/user-settings') ||
    pathname.startsWith('/profile')
  ) {
    const token = await readToken(request)
    if (!token) return toLogin(request, pathname)
    return NextResponse.next({ request })
  }

  // --- Защита /admin — требуется роль admin ---
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = await readToken(request)
    if (!token) return toLogin(request, pathname)

    if (!(token.roles ?? []).includes('admin')) {
      // Авторизован, но не админ — показываем страницу с объяснением, а не
      // тихий редирект на логин.
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }

    return NextResponse.next({ request })
  }

  // --- Защита /studio — только факт авторизации ---
  // Роли проверяются глубже, в layout и server actions через `studio-auth`.
  // Так и должно быть: server action — это POST на свой роут, и правка matcher
  // молча снимет с него защиту, если полагаться на proxy.
  if (pathname.startsWith('/studio') && pathname !== '/studio-access-denied') {
    const token = await readToken(request)
    if (!token) return toLogin(request, pathname)
    return NextResponse.next({ request })
  }

  if (pathname === '/release') {
    return permanent(request, CATALOG)
  }

  /*
   * Всё про /release/[slug] решается в одном месте, чтобы не выстраивать
   * цепочку 301: раньше `/release/ABC/full` получал редирект на нижний регистр,
   * а следом второй — на обрезку подмаршрута.
   *
   * Регистр приводить безопасно: слаги в БД только строчные — `slugSchema`
   * в `lib/schemas/studio.ts` не пропустит другие.
   */
  if (pathname.startsWith('/release/')) {
    const segments = pathname.split('/')
    const slug = (segments[2] ?? '').toLowerCase()

    if (!slug) return permanent(request, CATALOG)

    // Расшаренные цитаты переехали в /highlight/[id]. Проверка идёт до обрезки
    // подмаршрутов, иначе id цитаты потеряется.
    const highlight = pathname.match(/^\/release\/[^/]+\/highlight\/([^/]+)/)
    if (highlight) return permanent(request, `/highlight/${highlight[1]}`)

    // Подмаршруты релиза удалены (/release/[slug]/book|editionSlug|full|…):
    // по слагу издания в proxy не сориентироваться, его нет в URL.
    if (segments.length > 3 || segments[2] !== slug) {
      return permanent(request, `/release/${slug}`)
    }
  }

  // --- Редиректы со старой системы книг на Release ---
  if (pathname === '/books') {
    return permanent(request, CATALOG)
  }

  if (pathname.startsWith('/books/')) {
    // /books/[slug]/[chapter] или /books/[slug]/full -> /release/[slug];
    // без слага (`/books/`) вести на релиз некуда — отдаём каталог.
    const slug = (pathname.split('/')[2] ?? '').toLowerCase()
    return permanent(request, slug ? `/release/${slug}` : CATALOG)
  }

  // --- Редиректы Shop/Cart на Release ---
  if (pathname.startsWith('/shop') || pathname.startsWith('/cart')) {
    return permanent(request, CATALOG)
  }

  // --- Редиректы старой читалки на новую ---
  if (pathname.startsWith('/reader')) {
    // /reader/[editionId] -> /vvvvv/[editionId]
    const editionId = (pathname.split('/')[2] ?? '').toLowerCase()
    return permanent(request, editionId ? `/vvvvv/${editionId}` : CATALOG)
  }

  return NextResponse.next({ request })
}

/*
 * Matcher — белый список: на путях вне него proxy не вызывается вовсе. Поэтому
 * `/api/auth`, `/api/magic` и `/hi/` отдельно пропускать не нужно — их здесь
 * просто нет. Значения обязаны быть константами: Next разбирает их на сборке.
 */
export const config = {
  matcher: [
    '/profile/:path*',
    '/user',
    '/user-settings',
    '/user-settings/:path*',
    '/admin/:path*',
    '/studio/:path*',
    '/home',
    '/home/:path*',
    '/release',
    '/release/:path*',
    '/books',
    '/books/:path*',
    '/shop',
    '/shop/:path*',
    '/cart',
    '/cart/:path*',
    '/reader',
    '/reader/:path*',
  ],
}
