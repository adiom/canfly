import { Character } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';

import { presenceOf } from '@/components/character-presence';

interface CharacterCardProps {
  character: Character;
  priority?: boolean;
}

const TONE_DOT: Record<'on' | 'slow' | 'quiet', string> = {
  on: 'bg-cf-live-on cf-live-pulse',
  slow: 'bg-cf-live-slow',
  quiet: 'bg-cf-live-quiet',
};

/**
 * Герой в каталоге — портрет, а не плитка: круглый аватар со своим свечением,
 * имя тонким весом, сигнал присутствия. Карточки-рамки нет намеренно, чтобы
 * список читался как созвездие лиц, а не как сетка товаров.
 */
export function CharacterCard({ character, priority = false }: CharacterCardProps) {
  const presence = presenceOf(character);

  return (
    <Link
      href={`/characters/${character.slug}`}
      className="group flex flex-col items-center text-center"
    >
      <span className="relative">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--cf-air-accent) 45%, transparent) 0%, transparent 70%)',
            transform: 'scale(1.6)',
          }}
        />
        <span className="relative block h-24 w-24 overflow-hidden rounded-full bg-cf-air-surface-2 ring-1 ring-cf-air-line transition-transform duration-700 group-hover:-translate-y-1 md:h-28 md:w-28">
          {character.avatar ? (
            <Image
              src={character.avatar}
              alt={character.name}
              fill
              priority={priority}
              sizes="112px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl font-light text-cf-text-3">
              {character.name.trim()[0]}
            </span>
          )}
        </span>
      </span>

      <span className="mt-4 text-[15px] text-cf-text-heading transition-colors group-hover:text-cf-air-accent-ink">
        {character.name}
      </span>

      <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-cf-text-4">
        <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[presence.tone]}`} aria-hidden />
        {presence.label}
      </span>
    </Link>
  );
}
