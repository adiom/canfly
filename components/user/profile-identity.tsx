import Image from 'next/image'
import type { UserProfile } from '@/lib/types'
import type { SignatureTheme } from '@/lib/user-signature'

const JOINED = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/**
 * Шапка профиля. Имя набирается Cormorant light italic строчными — намеренно
 * не как заголовки разделов (font-black uppercase): профиль это человек,
 * а не рубрика каталога.
 */
export function ProfileIdentity({
  user,
  theme,
  publicRole,
  actions,
}: {
  user: Pick<UserProfile, 'display_name' | 'handle' | 'tagline' | 'bio' | 'avatar' | 'created_at'>
  theme: SignatureTheme
  publicRole: string
  actions?: React.ReactNode
}) {
  const badge = publicRole === 'author' ? 'Автор' : ''

  return (
    <section className="mx-auto max-w-7xl px-4 md:px-8">
      <div className="-mt-10 flex flex-col gap-5 sm:-mt-12 sm:flex-row sm:items-end">
        <div
          className="relative h-20 w-20 shrink-0 overflow-hidden border-2 bg-cf-bg-2 sm:h-24 sm:w-24"
          style={{ borderColor: theme.color.hex }}
        >
          {user.avatar ? (
            <Image src={user.avatar} alt="" fill sizes="96px" className="object-cover" />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center font-[family-name:var(--font-cormorant)] text-3xl italic"
              style={{ color: theme.color.hex }}
            >
              {user.display_name.slice(0, 1).toLowerCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 pb-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
            Читатель · с {JOINED.format(new Date(user.created_at))}
            {badge && ` · ${badge}`}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-cormorant)] text-[clamp(2.25rem,7vw,4rem)] font-light italic leading-[1.05] text-cf-text-heading">
            {user.display_name.toLowerCase()}
          </h1>
          <p className="mt-1 text-cf-text-3">
            <span className="font-mono text-xs">@{user.handle}</span>
            {user.tagline && <span className="italic"> · {user.tagline}</span>}
          </p>
        </div>

        {actions && <div className="flex shrink-0 gap-2 pb-1">{actions}</div>}
      </div>

      {user.bio && (
        <p className="mt-6 max-w-2xl leading-7 text-cf-text-caption">{user.bio}</p>
      )}
    </section>
  )
}
