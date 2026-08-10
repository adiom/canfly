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
        <p className="mb-6 text-[10px] font-black uppercase tracking-[0.22em] text-cf-accent">
          персонажи
        </p>
        <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {characters.map(character => (
            <Link
              key={character.id}
              href={`/characters/${character.slug}`}
              className="group flex shrink-0 flex-col items-center gap-2 rounded-xl border border-cf-text-1/10 bg-cf-bg-2 p-4 transition-all hover:border-cf-warm/45 hover:shadow-lg hover:shadow-cf-warm/5 md:w-[140px]"
            >
              <div className="relative h-16 w-16 overflow-hidden rounded-full bg-cf-text-1/8 ring-2 ring-cf-text-1/10 transition-all group-hover:ring-cf-warm/45">
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
              <span className="text-center text-sm font-bold leading-tight text-cf-text-heading transition-colors group-hover:text-cf-warm">
                {character.name}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-cf-text-3">
                {ROLE_LABELS[character.role] ?? character.role}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
