import { CharacterFriendButton } from '@/components/character-friend-button'
import { OrbitalPortrait, relationshipDots } from '@/components/character-orbital-portrait'
import { presenceOf } from '@/components/character-presence'
import type { Character, CharacterRelationshipWithTarget, CharacterStats } from '@/lib/types'

interface CharacterProfileHeroProps {
  character: Character
  stats: CharacterStats
  relationships: CharacterRelationshipWithTarget[]
}

const RELATIVE = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' })

/** «говорил три дня назад» — без date-библиотеки, силами Intl */
function spokeAgo(iso: string | null): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null

  const minutes = Math.round((then - Date.now()) / 60_000)
  const abs = Math.abs(minutes)

  if (abs < 60) return `говорил ${RELATIVE.format(minutes, 'minute')}`
  if (abs < 60 * 24) return `говорил ${RELATIVE.format(Math.round(minutes / 60), 'hour')}`
  if (abs < 60 * 24 * 30) return `говорил ${RELATIVE.format(Math.round(minutes / 1440), 'day')}`
  if (abs < 60 * 24 * 365) return `говорил ${RELATIVE.format(Math.round(minutes / 43_200), 'month')}`
  return `говорил ${RELATIVE.format(Math.round(minutes / 525_600), 'year')}`
}

function plural(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return `${value} ${one}`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} ${few}`
  return `${value} ${many}`
}

const TONE_DOT: Record<'on' | 'slow' | 'quiet', string> = {
  on: 'bg-cf-live-on cf-live-pulse',
  slow: 'bg-cf-live-slow',
  quiet: 'bg-cf-live-quiet',
}

/**
 * Первый экран профиля: герой в центре собственного созвездия, имя тонким
 * весом, под ним — только то, что правда есть в данных. Никакого хрома,
 * никакой обложки-плашки: между читателем и персонажем стоит один воздух.
 */
export function CharacterProfileHero({
  character,
  stats,
  relationships,
}: CharacterProfileHeroProps) {
  const canChat =
    character.can_receive_messages !== false && character.reply_mode !== 'disabled'
  const isCity = character.character_type === 'city'
  const presence = presenceOf(character)

  // Нули не показываем: пустая метрика — шум, а не информация
  const facts = [
    stats.friends > 0 ? plural(stats.friends, 'друг', 'друга', 'друзей') : null,
    stats.posts > 0 ? plural(stats.posts, 'запись', 'записи', 'записей') : null,
    stats.relations > 0 ? plural(stats.relations, 'связь', 'связи', 'связей') : null,
    spokeAgo(stats.last_spoke_at),
  ].filter((fact): fact is string => Boolean(fact))

  return (
    <section className="cf-rise flex flex-col items-center pt-24 md:pt-28">
      <OrbitalPortrait
        name={character.name}
        avatar={character.avatar}
        dots={relationshipDots(relationships)}
      />

      <h1 className="mt-6 text-center text-[34px] font-light leading-tight tracking-tight text-cf-text-heading md:text-[40px]">
        {character.name}
      </h1>

      <div className="mt-3 flex items-center gap-2.5 text-[13px]">
        <span className="text-cf-text-3">
          {isCity ? 'место вселенной' : 'персонаж вселенной'}
        </span>
        <span className="text-cf-text-4">·</span>
        <span className="inline-flex items-center gap-2 text-cf-text-3">
          <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[presence.tone]}`} aria-hidden />
          {presence.label}
        </span>
      </div>

      {character.bio ? (
        <p className="mt-6 max-w-md text-center text-[15px] leading-relaxed text-cf-text-caption">
          {character.bio}
        </p>
      ) : null}

      <div className="mt-9">
        <CharacterFriendButton characterSlug={character.slug} canReceiveMessages={canChat} />
      </div>

      {facts.length > 0 ? (
        <p className="mt-10 text-center font-mono text-[11px] text-cf-text-4">
          {facts.join(' · ')}
        </p>
      ) : null}
    </section>
  )
}
