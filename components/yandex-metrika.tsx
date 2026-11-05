'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import Script from 'next/script'

export function YandexMetrika() {
  const pathname = usePathname()

  // Keep goals on real user actions, not on page loading. Delegation covers
  // server-rendered Release links without converting the whole page to client JS.
  useEffect(() => {
    if (pathname.startsWith('/studio')) return

    const goals = new Set(['edition_open', 'character_chat_open', 'external_edition_open'])
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return
      const link = event.target.closest('a[data-metrika-goal]')
      const goal = link?.getAttribute('data-metrika-goal')
      if (!goal || !goals.has(goal)) return

      // Studio navigations may happen client-side while a tracker is mounted.
      if (window.location.pathname.startsWith('/studio')) return
      const ym = (window as Window & { ym?: (...args: unknown[]) => void }).ym
      if (typeof ym === 'function') ym(42420764, 'reachGoal', goal)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [pathname])

  if (pathname.startsWith('/studio')) return null

  return (
    <Script
      id="yandex-metrika"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(42420764,"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});`,
      }}
    />
  )
}