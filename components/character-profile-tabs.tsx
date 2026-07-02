import Link from 'next/link'
import Image from 'next/image'

import { CharacterPostsFeed } from '@/components/character-posts-feed'
import { CharacterWall } from '@/components/character-wall'
import type {
  Character,
  CharacterFriendSummary,
  CharacterPostWithCharacter,
  CharacterRelationship,
  CharacterWallPostWithUser,
} from '@/lib/types'

type Tab = 'feed' | 'about' | 'relations' | 'wall'

interface CharacterProfileTabsProps {
  slug: string
  activeTab: Tab
  character: Character
  relationships: CharacterRelationship[]
  posts: CharacterPostWithCharacter[]
  friends: CharacterFriendSummary[]
  wall: CharacterWallPostWithUser[]
  currentUserId: string | null
  isAdmin: boolean
}

const tabs: { key: Tab; label: string }[] = [
  { key: 'feed', label: 'Лента' },
  { key: 'about', label: 'О герое' },
  { key: 'relations', label: 'Связи' },
  { key: 'wall', label: 'Стена' },
]

export function CharacterProfileTabs({
  slug,
  activeTab,
  character,
  relationships,
  friends,
  wall,
  currentUserId,
  isAdmin,
}: CharacterProfileTabsProps) {
  return (
    <div className="mt-10">
      <nav className="flex overflow-x-auto border-b border-[#f4efe5]/10">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <Link
              key={tab.key}
              href={`/characters/${slug}?tab=${tab.key}`}
              scroll={false}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] transition-colors ${
                isActive
                  ? 'border-[#d52525] text-[#f4efe5]'
                  : 'border-transparent text-[#ded7cc] hover:text-[#f4efe5]'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <div className="py-8">
        {activeTab === 'feed' && <CharacterPostsFeed characterSlug={slug} />}
        {activeTab === 'about' && <AboutTab character={character} friends={friends} />}
        {activeTab === 'relations' && <RelationsTab relationships={relationships} />}
        {activeTab === 'wall' && (
          <CharacterWall
            slug={slug}
            initialPosts={wall}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </div>
  )
}

function AboutTab({
  character,
  friends,
}: {
  character: Character
  friends: CharacterFriendSummary[]
}) {
  return (
    <div className="grid gap-8 md:grid-cols-3">
      <div className="md:col-span-2 space-y-6">
        <section>
          <h2 className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#f6d6a8]">
            Биография
          </h2>
          <p className="whitespace-pre-wrap text-base leading-7 text-[#f4efe5]">
            {character.full_description || 'Подробное описание отсутствует.'}
          </p>
        </section>

        {character.abilities?.length ? (
          <section>
            <h2 className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#f6d6a8]">
              Способности
            </h2>
            <ul className="space-y-2">
              {character.abilities.map((ability, idx) => (
                <li
                  key={idx}
                  className="border border-[#f4efe5]/10 bg-[#1b1c19] px-3 py-2 text-sm text-[#ded7cc]"
                >
                  {ability}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {character.personality ? (
          <section>
            <h2 className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#f6d6a8]">
              Характер
            </h2>
            <p className="whitespace-pre-wrap text-base leading-7 text-[#f4efe5]">
              {character.personality}
            </p>
          </section>
        ) : null}
      </div>

      <aside className="space-y-6">
        {character.speaking_style ? (
          <Card title="Манера речи" body={character.speaking_style} />
        ) : null}
        {character.knowledge_scope ? (
          <Card title="Границы знаний" body={character.knowledge_scope} />
        ) : null}
        {character.spoiler_policy ? (
          <Card title="Политика спойлеров" body={character.spoiler_policy} />
        ) : null}
        {character.boundaries ? (
          <Card title="Ограничения" body={character.boundaries} />
        ) : null}

        {friends.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#f6d6a8]">
              Близкие друзья
            </h2>
            <ul className="space-y-2">
              {friends.slice(0, 6).map((friend) => (
                <li
                  key={friend.id}
                  className="flex items-center gap-3 border border-[#f4efe5]/10 bg-[#1b1c19] px-3 py-2"
                >
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#111210]">
                    {friend.avatar ? (
                      <Image
                        src={friend.avatar}
                        alt={friend.display_name}
                        width={36}
                        height={36}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-black text-[#f4efe5]/40">
                        {friend.display_name[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[#f4efe5]">
                      {friend.display_name}
                    </div>
                    <div className="truncate text-xs text-[#ded7cc]/60">@{friend.handle}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>
    </div>
  )
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-[#f4efe5]/10 bg-[#1b1c19] p-4">
      <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#f6d6a8]">
        {title}
      </h3>
      <p className="whitespace-pre-wrap text-sm leading-6 text-[#ded7cc]">{body}</p>
    </div>
  )
}

function RelationsTab({ relationships }: { relationships: CharacterRelationship[] }) {
  if (relationships.length === 0) {
    return (
      <p className="text-center text-[#ded7cc]/60 py-8">Связей пока нет</p>
    )
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {relationships.map((rel) => (
        <div key={rel.id} className="border border-[#f4efe5]/10 bg-[#1b1c19] p-5">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-black uppercase text-[#f4efe5]">{rel.relationship_type}</h4>
            <span className="border border-[#9db5c8]/30 bg-[#9db5c8]/10 px-2 py-1 text-xs text-[#9db5c8]">
              Связь
            </span>
          </div>
          {rel.description ? (
            <p className="text-sm text-[#ded7cc]">{rel.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  )
}
