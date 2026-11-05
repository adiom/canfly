import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, MessageCircle } from 'lucide-react'
import type { ReleaseCharacter } from './types'
import { ReleaseDescription } from './release-description'
import styles from './release.module.css'

const ROLE_LABELS: Record<string, string> = {
  main: 'Главный герой', supporting: 'Второстепенный персонаж', cameo: 'Камео',
}

function CharacterRow({ character, featured }: { character: ReleaseCharacter; featured: boolean }) {
  return <li className={styles.characterCard} data-featured={featured}>
    {character.avatar ? <Link href={`/characters/${character.slug}`} className={styles.characterPortrait} aria-label={`Профиль ${character.name}`}>
      <Image src={character.avatar} alt="" fill sizes={featured ? '112px' : '48px'} className="object-cover" />
    </Link> : null}
    <div className={styles.characterInfo}>
      <p className={styles.characterRole}>{ROLE_LABELS[character.role] ?? character.role}</p>
      <h3>{character.name}</h3>
      {character.bio ? <ReleaseDescription text={character.bio} limit={featured ? 220 : 100} /> : null}
      <div className={styles.characterActions}>
        {character.canChat ? <Link className={featured ? styles.explorerLink : styles.textLink} href={`/characters/${character.slug}/chat`} data-metrika-goal="character_chat_open">
          <MessageCircle size={16} aria-hidden="true" />Поговорить
        </Link> : null}
        <Link className={styles.textLink} href={`/characters/${character.slug}`}>Профиль<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </div>
  </li>
}

export function ReleaseCharacters({ characters }: { characters: ReleaseCharacter[] }) {
  const ordered = [...characters].sort((a, b) => Number(b.role === 'main') - Number(a.role === 'main'))
  return <section aria-labelledby="release-characters-title">
    <h2 id="release-characters-title" className={styles.sectionSubtitle}>Персонажи <span className={styles.count}>· {characters.length}</span></h2>
    <ul className={styles.characterList}>{ordered.slice(0, 3).map((character, index) =>
      <CharacterRow key={character.id} character={character} featured={index === 0} />)}</ul>
    {ordered.length > 3 ? <details className={styles.more}><summary>Ещё персонажи · {ordered.length - 3}</summary>
      <ul>{ordered.slice(3).map(character => <CharacterRow key={character.id} character={character} featured={false} />)}</ul>
    </details> : null}
  </section>
}
