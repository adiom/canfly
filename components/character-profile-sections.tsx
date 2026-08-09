import Link from 'next/link'
import Image from 'next/image'

import { CharacterPostsFeed } from '@/components/character-posts-feed'
import { CharacterWall } from '@/components/character-wall'
import type {
  Character,
  CharacterFriendSummary,
  CharacterPostWithCharacter,
  CharacterRelationshipWithTarget,
  CharacterWallPostWithUser,
} from '@/lib/types'

interface CharacterProfileSectionsProps {
  slug: string
  character: Character
  relationships: CharacterRelationshipWithTarget[]
  posts: CharacterPostWithCharacter[]
  friends: CharacterFriendSummary[]
  wall: CharacterWallPostWithUser[]
  currentUserId: string | null
  isAdmin: boolean
}

/**
 * Профиль одной лентой, без вкладок: герой раскрывается по мере скролла,
 * а не по клику. Пустые разделы просто не рендерятся — страница короче у
 * того, о ком известно меньше, и это честно.
 */
export function CharacterProfileSections({
  slug,
  character,
  relationships,
  posts,
  friends,
  wall,
  currentUserId,
  isAdmin,
}: CharacterProfileSectionsProps) {
  return (
    <div className="cf-rise-late mt-24 space-y-20">
      {posts.length > 0 ? (
        <Section id="posts" title="Записи">
          <CharacterPostsFeed posts={posts} />
        </Section>
      ) : null}

      {relationships.length > 0 ? (
        <Section id="relations" title="Связи">
          <Relations relationships={relationships} />
        </Section>
      ) : null}

      <Section id="about" title="О герое">
        <About character={character} friends={friends} />
      </Section>

      <Section id="wall" title="Стена">
        <CharacterWall
          slug={slug}
          initialPosts={wall}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      </Section>
    </div>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-6 text-[12px] uppercase tracking-[0.28em] text-cf-text-3">{title}</h2>
      {children}
    </section>
  )
}
function About({
  character,
  friends,
}: {
  character: Character
  friends: CharacterFriendSummary[]
}) {
  const facets = [
    { title: 'Манера речи', body: character.speaking_style },
    { title: 'Границы знаний', body: character.knowledge_scope },
    { title: 'Политика спойлеров', body: character.spoiler_policy },
    { title: 'Ограничения', body: character.boundaries },
  ].filter((f): f is { title: string; body: string } => Boolean(f.body))

  return (
    <div className="space-y-10">
      <p className="max-w-2xl whitespace-pre-wrap text-[15px] leading-8 text-cf-text-2">
        {character.full_description || character.bio || 'Подробное описание ещё не написано.'}
      </p>

      {character.personality ? (
        <p className="max-w-2xl whitespace-pre-wrap text-[15px] leading-8 text-cf-text-caption">
          {character.personality}
        </p>
      ) : null}

      {character.abilities?.length ? (
        <ul className="flex flex-wrap gap-2">
          {character.abilities.map((ability, idx) => (
            <li
              key={idx}
              className="rounded-full bg-cf-air-surface px-4 py-2 text-[13px] text-cf-text-2 backdrop-blur-xl"
            >
              {ability}
            </li>
          ))}
        </ul>
      ) : null}

      {facets.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {facets.map((facet) => (
            <div key={facet.title} className="rounded-[24px] bg-cf-air-surface p-5 backdrop-blur-xl">
              <h3 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-cf-air-accent-ink">
                {facet.title}
              </h3>
              <p className="whitespace-pre-wrap text-[13px] leading-6 text-cf-text-caption">
                {facet.body}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {friends.length > 0 ? (
        <div>
          <h3 className="mb-4 text-[10px] uppercase tracking-[0.2em] text-cf-text-3">
            Читатели рядом
          </h3>
          <ul className="flex flex-wrap gap-3">
            {friends.slice(0, 8).map((friend) => (
              <li key={friend.id} className="flex items-center gap-2.5">
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-cf-air-surface-2">
                  {friend.avatar ? (
                    <Image
                      src={friend.avatar}
                      alt={friend.display_name}
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[11px] text-cf-text-3">
                      {friend.display_name[0]}
                    </span>
                  )}
                </span>
                <span className="text-[13px] text-cf-text-caption">{friend.display_name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function Relations({
  relationships,
}: {
  relationships: CharacterRelationshipWithTarget[]
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {relationships.map((rel) => (
        <Link
          key={rel.id}
          href={`/characters/${rel.related_slug}`}
          className="group rounded-[24px] bg-cf-air-surface px-5 py-4 shadow-[var(--cf-air-shadow)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:bg-cf-air-surface-2"
        >
          <div className="flex items-center gap-3.5">
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-cf-air-surface-2">
              {rel.related_avatar ? (
                <Image
                  src={rel.related_avatar}
                  alt={rel.related_name}
                  width={44}
                  height={44}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[13px] text-cf-text-3">
                  {rel.related_name[0]}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] text-cf-text-heading transition-colors group-hover:text-cf-air-accent-ink">
                {rel.related_name}
              </span>
              <span className="block truncate text-[11px] text-cf-text-3">
                {rel.relationship_type}
              </span>
            </span>
          </div>
          {rel.description ? (
            <p className="mt-3.5 line-clamp-3 text-[13px] leading-6 text-cf-text-caption">
              {rel.description}
            </p>
          ) : null}
        </Link>
      ))}
    </div>
  )
}

