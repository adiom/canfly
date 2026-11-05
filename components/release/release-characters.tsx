import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, MessageCircle } from 'lucide-react'
import type { ReleaseCharacter } from './types'
import styles from './release.module.css'

const ROLE_LABELS: Record<string, string> = {
  main: 'Главный герой',
  supporting: 'Второстепенный персонаж',
  cameo: 'Камео',
}

export function ReleaseCharacters({ characters }: { characters: ReleaseCharacter[] }) {
  return (
    <section aria-labelledby="release-characters-title">
      <h2 id="release-characters-title" className={styles.sectionSubtitle}>Персонажи</h2>
      <ul className={styles.characterList}>
        {characters.map(character => (
          <li key={character.id} className={styles.characterCard}>
            {character.avatar ? (
              <Link href={`/characters/${character.slug}`} className={styles.characterPortrait} aria-label={`Профиль ${character.name}`}>
                <Image src={character.avatar} alt="" fill sizes="(max-width: 640px) 112px, 180px" className="object-cover" />
              </Link>
            ) : null}
            <div className={styles.characterInfo}>
              <p className={styles.characterRole}>{ROLE_LABELS[character.role] ?? character.role}</p>
              <h3>{character.name}</h3>
              {character.bio ? <p className={styles.characterBio}>{character.bio}</p> : null}
              <div className={styles.characterActions}>
                {character.canChat ? <Link className={styles.explorerLink} href={`/characters/${character.slug}/chat`}><MessageCircle size={16} aria-hidden="true" /> Поговорить</Link> : null}
                <Link className={styles.textLink} href={`/characters/${character.slug}`}>Профиль <ArrowRight size={16} aria-hidden="true" /></Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
