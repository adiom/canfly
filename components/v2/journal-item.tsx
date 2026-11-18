import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { FeedItem } from '@/lib/v2-feed'
import { JournalImage } from './journal-image'
import styles from './journal.module.css'

const LABELS = { excerpt: 'Фрагмент', place: 'Место', relationship: 'Связь', thought: 'Мысль', quote: 'Цитата' }

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className={styles.sourceLink}>{children}<ArrowUpRight size={17} strokeWidth={1.4} aria-hidden="true" /></Link>
}

export function JournalItem({ item, number }: { item: FeedItem; number: number }) {
  const titleId = `journal-${item.id.replace(':', '-')}`
  return (
    <article className={`${styles.item} ${styles[item.kind]}`} data-feed-id={item.id} data-feed-kind={item.kind} aria-labelledby={titleId}>
      <div className={styles.itemMeta}><span>{LABELS[item.kind]}</span><span aria-hidden="true">{String(number).padStart(2, '0')}</span></div>
      {item.kind === 'excerpt' ? (
        <>
          <p className={styles.source}>{item.source}</p>
          <h3 id={titleId} className={styles.title}>{item.title}</h3>
          <div className={styles.prose}>{item.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
          <SourceLink href={item.href}>Читать дальше</SourceLink>
        </>
      ) : null}
      {item.kind === 'place' ? (
        <>
          {item.era ? <p className={styles.source}>{item.era}</p> : null}
          <h3 id={titleId} className={styles.placeTitle}>{item.title}<span className={styles.dot}>.</span></h3>
          {item.image ? <figure className={styles.landscape}>
            <JournalImage src={item.image} name={item.title} />
            {item.illustrated ? <figcaption>Художественный образ города</figcaption> : null}
          </figure> : null}
          {item.description ? <p className={styles.placeDescription}>{item.description}</p> : null}
          {item.residents.length ? <div className={styles.residents}>
            <span className={styles.source}>Люди этого места</span>
            <div>{item.residents.map((person) => <Link key={person.href} href={person.href}><span className={styles.smallAvatar}><JournalImage src={person.avatar} name={person.name} portrait /></span>{person.name}</Link>)}</div>
          </div> : null}
          <SourceLink href={item.href}>Исследовать место</SourceLink>
        </>
      ) : null}
      {item.kind === 'relationship' ? (
        <>
          <h3 id={titleId} className={styles.srOnly}>{item.from.name} и {item.to.name}: {item.label}</h3>
          <div className={styles.pair}>
            <Link href={item.from.href} className={styles.person}>
              <JournalImage src={item.from.avatar} name={item.from.name} portrait /><span>{item.from.name}</span>
            </Link>
            <div className={styles.connection}>
              <span>{item.label}</span>
              <svg viewBox="0 0 120 54" fill="none" aria-hidden="true"><path d="M2 8 Q60 70 116 8 M106 10 L116 8 L115 18" stroke="currentColor" strokeWidth="1.3" /></svg>
            </div>
            <Link href={item.to.href} className={`${styles.person} ${styles.secondPerson}`}>
              <JournalImage src={item.to.avatar} name={item.to.name} portrait /><span>{item.to.name}</span>
            </Link>
          </div>
          {item.description ? <p className={styles.relationshipText}>{item.description}</p> : null}
          <div className={styles.pairLinks}><SourceLink href={item.from.href}>{item.from.name}</SourceLink><SourceLink href={item.to.href}>{item.to.name}</SourceLink></div>
        </>
      ) : null}
      {item.kind === 'thought' ? (
        <>
          <div className={styles.byline}>
            <Link href={item.person.href} className={styles.smallAvatar}><JournalImage src={item.person.avatar} name={item.person.name} portrait /></Link>
            <h3 id={titleId}><Link href={item.person.href}>{item.person.name}</Link></h3>
          </div>
          <p className={styles.thoughtText}>{item.text}</p>
          {item.image ? <div className={styles.postImage}><JournalImage src={item.image} name={`Иллюстрация к записи: ${item.person.name}`} /></div> : null}
          <SourceLink href={item.person.href}>К персонажу</SourceLink>
        </>
      ) : null}
      {item.kind === 'quote' ? (
        <>
          <h3 id={titleId} className={styles.srOnly}>Цитата из «{item.source}»</h3>
          <ArrowDownRight className={styles.quoteMark} size={26} strokeWidth={1} aria-hidden="true" />
          <blockquote>{item.text}</blockquote>
          <p className={styles.quoteSource}>«{item.source}»</p>
          <SourceLink href={item.href}>Открыть контекст</SourceLink>
        </>
      ) : null}
    </article>
  )
}
