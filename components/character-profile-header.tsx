import { BookOpen, MessageCircle, Users } from 'lucide-react'
import Image from 'next/image'

import { CharacterFriendButton } from '@/components/character-friend-button'
import type { Character, CharacterStats } from '@/lib/types'

interface CharacterProfileHeaderProps {
  character: Character
  stats: CharacterStats
}

export function CharacterProfileHeader({ character, stats }: CharacterProfileHeaderProps) {
  const canChat =
    character.can_receive_messages !== false && character.reply_mode !== 'disabled'

  return (
    <div className="relative -mx-4 mb-8 md:-mx-8">
      <div className="h-40 bg-gradient-to-br from-[#d52525] via-[#7a1818] to-[#1b1c19] md:h-56" />
      <div className="mx-auto -mt-16 max-w-5xl px-4 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-end">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full border-4 border-[#111210] bg-[#1b1c19] shadow-2xl">
              {character.avatar ? (
                <Image
                  src={character.avatar}
                  alt={character.name}
                  width={128}
                  height={128}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-black uppercase text-[#f4efe5]/40">
                  {character.name[0]}
                </div>
              )}
            </div>
            <div className="md:pb-2">
              <p className="mb-1 text-xs font-black uppercase tracking-[0.22em] text-[#f6d6a8]">
                персонаж вселенной
              </p>
              <h1 className="text-4xl font-black uppercase leading-none text-[#f4efe5] md:text-5xl">
                {character.name}
              </h1>
              {character.bio ? (
                <p className="mt-3 max-w-xl text-base text-[#ded7cc]">{character.bio}</p>
              ) : null}
            </div>
          </div>
          <div className="md:pb-2">
            <CharacterFriendButton
              characterSlug={character.slug}
              canReceiveMessages={canChat}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-[#f4efe5]/10 pt-6 md:gap-6">
          <Stat icon={<Users className="h-4 w-4" />} label="Друзей" value={stats.friends} />
          <Stat
            icon={<MessageCircle className="h-4 w-4" />}
            label="Постов"
            value={stats.posts}
          />
          <Stat icon={<BookOpen className="h-4 w-4" />} label="Книг" value={stats.books} />
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-3 border-l-2 border-[#d52525] pl-3 md:pl-4">
      <div className="text-[#f6d6a8]">{icon}</div>
      <div>
        <div className="text-xl font-black text-[#f4efe5] md:text-2xl">{value}</div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ded7cc]/70 md:text-xs">
          {label}
        </div>
      </div>
    </div>
  )
}
