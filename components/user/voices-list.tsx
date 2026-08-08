import Link from 'next/link'

interface Voice {
  id: string
  character_slug: string
  character_name: string
  character_avatar: string | null
  last_message: string | null
}

export function VoicesList({ voices }: { voices: Voice[] }) {
  if (voices.length === 0) {
    return (
      <div className="border border-dashed border-cf-text-1/15 p-8 text-center">
        <p className="text-cf-text-3">Пока ни одного разговора</p>
        <Link
          href="/characters"
          className="mt-3 inline-block font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent hover:underline"
        >
          Познакомиться
        </Link>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-cf-text-1/10 border-y border-cf-text-1/10">
      {voices.map(voice => (
        <li key={voice.id}>
          <Link
            href={`/characters/${voice.character_slug}`}
            className="group block py-4 transition-colors hover:bg-cf-text-1/[0.03]"
          >
            <p className="text-cf-text-1 group-hover:text-cf-text-heading">
              {voice.character_name}
            </p>
            {voice.last_message && (
              <p className="mt-1 line-clamp-1 text-sm text-cf-text-3">{voice.last_message}</p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
