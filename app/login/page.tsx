import Link from 'next/link'

import { skyIndexForHour } from '@/lib/canfly-colors'
import { getCurrentUser } from '@/lib/server/session'
import { AlreadySignedIn } from './already-signed-in'
import { LoginForm } from './login-form'
import { SkyPanel } from './sky-panel'

// Страница читает сессию, поэтому рендер динамический — это нормально для логина.
export default async function LoginPage() {
  const user = await getCurrentUser()
  // Час берём на сервере (в проде это UTC) — панель показывает не точное время
  // читателя, а состояние неба; главное, чтобы клиент не пересчитывал его сам.
  const skyIndex = skyIndexForHour(new Date().getHours())

  return (
    <main className="flex min-h-screen flex-col bg-cf-bg text-cf-text-1 lg:flex-row">
      <SkyPanel initialIndex={skyIndex} className="h-[26vh] min-h-[190px] w-full lg:hidden" />

      <div className="flex w-full flex-col px-6 py-8 sm:px-10 lg:w-1/2 lg:px-16 lg:py-12 xl:px-24">
        <Link
          href="/"
          className="self-start font-mono text-[11px] uppercase tracking-[0.34em] text-cf-text-1 transition-colors hover:text-cf-accent"
        >
          canfly
        </Link>

        <div className="flex flex-1 items-center py-12 lg:py-16">
          <div className="w-full max-w-[27rem]">
            {user ? (
              <AlreadySignedIn
                displayName={user.display_name}
                identity={user.email ?? `@${user.handle}`}
              />
            ) : (
              <LoginForm />
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-cf-text-1/10 pt-5 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
          <Link href="/" className="transition-colors hover:text-cf-text-1">
            ← на главную
          </Link>
          <Link href="/colors" className="transition-colors hover:text-cf-text-1">
            коллекция цветов
          </Link>
        </footer>
      </div>

      <SkyPanel initialIndex={skyIndex} className="hidden lg:block lg:w-1/2" />
    </main>
  )
}
