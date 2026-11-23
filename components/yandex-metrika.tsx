'use client'

import { usePathname } from 'next/navigation'
import Script from 'next/script'

export function YandexMetrika() {
  const pathname = usePathname()

  // Avoid tracking local development and sending E2E requests to a third party.
  if (process.env.NODE_ENV !== 'production' || pathname.startsWith('/studio')) return null

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