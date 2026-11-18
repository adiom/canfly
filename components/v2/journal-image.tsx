'use client'

import Image from 'next/image'
import { useState } from 'react'
import styles from './journal.module.css'

/** Missing portraits keep their typographic identity, never a fake person. */
export function JournalImage({ src, name, portrait = false }: { src: string | null; name: string; portrait?: boolean }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className={`${styles.image} ${portrait ? styles.portraitImage : ''}`}>
      <span className={styles.initial} aria-hidden="true">{name.trim().slice(0, 1)}</span>
      {src && !failed ? (
        <Image src={src} alt={name} fill sizes={portrait ? '(max-width: 600px) 36vw, 240px' : '(max-width: 740px) 100vw, 740px'} onError={() => setFailed(true)} />
      ) : null}
    </span>
  )
}
