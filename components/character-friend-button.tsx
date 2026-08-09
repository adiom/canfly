'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageCircle, UserPlus, UserMinus } from 'lucide-react'
import { useSession } from 'next-auth/react'

import { Button } from '@/components/ui/button'

interface CharacterFriendButtonProps {
  characterSlug: string
  canReceiveMessages: boolean
}

export function CharacterFriendButton({
  characterSlug,
  canReceiveMessages,
}: CharacterFriendButtonProps) {
  const { status: authStatus } = useSession()
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch статуса дружбы при авторизации. setState в effect — data-loading.
  useEffect(() => {
    if (authStatus !== 'authenticated') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- data-loading: reset on unauth
      setLoading(false)
      setFriendshipStatus(null)
      return
    }

    let active = true

    const loadFriendship = async () => {
      try {
        const response = await fetch(`/api/characters/${characterSlug}/friendship`)
        const payload = await response.json()

        if (active) {
          setFriendshipStatus(payload.data?.friendship?.status || null)
        }
      } catch {
        if (active) setFriendshipStatus(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadFriendship()

    return () => {
      active = false
    }
  }, [characterSlug, authStatus])

  const addFriend = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/characters/${characterSlug}/friendship`, {
        method: 'POST',
      })
      const payload = await response.json()
      setFriendshipStatus(payload.data?.friendship?.status || null)
    } finally {
      setLoading(false)
    }
  }

  const removeFriend = async () => {
    setLoading(true)
    try {
      await fetch(`/api/characters/${characterSlug}/friendship`, { method: 'DELETE' })
      setFriendshipStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const isFriend = friendshipStatus === 'accepted'

  return (
    <div className="flex flex-wrap gap-3">
      {isFriend ? (
        <Button
          type="button"
          onClick={removeFriend}
          disabled={loading}
          variant="outline"
          className="h-11 rounded-full border-cf-air-line bg-cf-air-surface px-6 text-sm font-medium text-cf-text-2 backdrop-blur-xl hover:border-cf-accent/40 hover:bg-cf-accent/10 hover:text-cf-accent"
        >
          <UserMinus className="mr-2 h-4 w-4" />
          Удалить из друзей
        </Button>
      ) : (
        <Button
          type="button"
          onClick={addFriend}
          disabled={loading}
          className="h-11 rounded-full bg-cf-air-accent px-6 text-sm font-medium text-white hover:bg-cf-air-accent-ink"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          {loading ? 'Проверка...' : 'Добавить в друзья'}
        </Button>
      )}

      {canReceiveMessages ? (
        <Button
          asChild
          variant="outline"
          className="h-11 rounded-full border-cf-air-line bg-cf-air-surface px-6 text-sm font-medium text-cf-air-accent-ink backdrop-blur-xl hover:border-cf-air-accent/40 hover:bg-cf-air-surface-2 hover:text-cf-air-accent-ink"
        >
          <Link href={`/characters/${characterSlug}/chat`}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Написать
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled
          className="h-11 rounded-full border-cf-air-line bg-cf-air-surface px-6 text-sm font-medium text-cf-text-3 backdrop-blur-xl"
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          Недоступно
        </Button>
      )}
    </div>
  )
}
