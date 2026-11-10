import Image from 'next/image'
import Link from 'next/link'

import type { V2CharacterCard } from '@/lib/server/v2'
import { SceneReveal } from './scene-reveal'
import styles from './v2.module.css'

/**
 * Сцена 03 — персонажи.
 *
 * Карточка без аватара получает абстрактную подложку (`.personAbstract`).
 * Кнопка чата рисуется только при подтверждённой доступности: `chatHref`
 * заполняется сервером через `resolveCharacterChatAvailability`, поэтому
 * здесь не обещается разговор, которого не будет.
 */
interface CharacterSceneProps {
  characters: V2CharacterCard[]
}

export function CharacterScene({ characters }: CharacterSceneProps) {
  if (characters.length === 0) return null

  return (
    <section className={`${styles.shell} ${styles.people}`} id="characters">
      <div className={styles.sectionHead}>
        <small className={styles.sectionHeadSmall}>02 / The people inside</small>
        <Link href="/characters" className={styles.sectionHeadLink}>
          Все персонажи ↗
        </Link>
      </div>

      <SceneReveal>
        <h2 className={styles.peopleLead}>
          Не просто герои. <i className={styles.peopleLeadI}>Люди,</i> у которых
          можно задержаться.
        </h2>
      </SceneReveal>

      <div className={styles.peopleGrid}>
        {characters.map((character, index) => (
          <SceneReveal key={character.slug} className={styles.person}>
            {character.avatar ? (
              <Image
                className={styles.personImg}
                src={character.avatar}
                alt={character.name}
                fill
                sizes="(max-width: 600px) 100vw, (max-width: 950px) 50vw, 33vw"
              />
            ) : (
              <div className={styles.personAbstract} aria-hidden="true" />
            )}
            <div className={styles.personShade} aria-hidden="true" />
            <span className={styles.personNum}>
              {String(index + 1).padStart(2, '0')} — CHARACTER
            </span>
            <div className={styles.personBody}>
              <h3 className={styles.personName}>
                <Link href={character.href}>{character.name}</Link>
              </h3>
              {character.bio ? <p className={styles.personBio}>{character.bio}</p> : null}
              <div className={styles.personActions}>
                <Link href={character.href} className={styles.personAction}>
                  Познакомиться ↗
                </Link>
                {character.chatHref ? (
                  <Link href={character.chatHref} className={styles.personAction}>
                    Поговорить ↗
                  </Link>
                ) : null}
              </div>
            </div>
          </SceneReveal>
        ))}
      </div>
    </section>
  )
}
