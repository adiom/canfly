'use client'

import { useEffect } from 'react'

export function useUnsavedReleaseChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = true
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
}
