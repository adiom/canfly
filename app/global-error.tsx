'use client'

import Link from 'next/link'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, background: '#111210', color: '#f4efe5', fontFamily: 'sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ maxWidth: '28rem', width: '100%' }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem', textDecoration: 'none' }}>
              <span style={{ display: 'flex', height: '2.25rem', width: '4rem', alignItems: 'center', justifyContent: 'center', background: '#d52525', color: '#fff', fontWeight: 900, fontSize: '1.125rem', textTransform: 'uppercase', letterSpacing: '-0.04em' }}>
                canfly
              </span>
            </Link>

            <p style={{ fontFamily: 'monospace', fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.22em', color: '#d52525', marginBottom: '1rem' }}>
              Критическая ошибка
            </p>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1, color: '#fff8ea', marginBottom: '1rem' }}>
              Приложение упало
            </h1>
            <p style={{ lineHeight: 1.75, color: '#c9c1b4', marginBottom: '2.5rem' }}>
              Произошла критическая ошибка. Попробуйте перезагрузить страницу.
              {process.env.NODE_ENV === 'development' && error?.message && (
                <span style={{ display: 'block', marginTop: '0.75rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#9f978b', wordBreak: 'break-all' }}>
                  {error.message}
                </span>
              )}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button
                onClick={() => window.location.reload()}
                style={{ height: '3rem', padding: '0 1.25rem', background: '#d25252', color: '#fff', fontWeight: 900, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.1em', border: 'none', cursor: 'pointer' }}
              >
                Обновить страницу
              </button>
              <button
                onClick={reset}
                style={{ height: '3rem', padding: '0 1.25rem', border: '1px solid rgba(244,239,229,0.18)', color: '#f4efe5', fontWeight: 700, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'transparent', cursor: 'pointer' }}
              >
                Попробовать снова
              </button>
              <Link
                href="/"
                style={{ height: '3rem', padding: '0 1.25rem', border: '1px solid rgba(244,239,229,0.18)', color: '#f4efe5', fontWeight: 700, fontSize: '0.875rem', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
              >
                На главную
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
