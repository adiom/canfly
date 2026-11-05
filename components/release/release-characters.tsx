import Image from 'next/image'
import Link from 'next/link'
import type { ReleaseCharacter } from './types'

const ROLE_LABELS: Record<string, string> = {
  main: 'Главный',
  supporting: 'Второстепенный',
  cameo: 'Камео',
}

export function ReleaseCharacters({ characters }: { characters: ReleaseCharacter[] }) {
  if (characters.length === 0) return null

  return (
    <section className="border-t border-cf-text-1/10">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <h3 className="mb-2 text-2xl font-semibold tracking-tight text-cf-text-heading md:text-3xl">Персонажи</h3>
        <p className="mb-6 text-sm leading-relaxed text-cf-text-2">Герои, связанные с этим произведением.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map(character => (
            <Link
              key={character.id}
              href={`/characters/${character.slug}`}
              className="group flex min-w-0 items-center gap-4 rounded-xl border border-cf-text-1/10 bg-cf-bg-2 p-4 transition-colors hover:border-cf-warm focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-cf-text-1/8 ring-2 ring-cf-text-1/10 transition-all group-hover:ring-cf-warm/45">
                {character.avatar ? (
                  <Image
                    src={character.avatar}
                    alt={character.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold text-cf-text-3">
                    {character.name.charAt(0)}
                  </div>
                )}
              </div>
              <span className="min-w-0 text-base font-bold leading-tight text-cf-text-heading transition-colors group-hover:text-cf-warm">
                {character.name}
                <span className="mt-1 block text-xs font-normal text-cf-text-3">
                  {ROLE_LABELS[character.role] ?? character.role}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
