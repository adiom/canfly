'use client'

import { useState } from 'react'

import type { V2MediaRelease } from '@/lib/server/v2'
import { MediaSceneView, initialMediaView, type MediaView } from './media-scene-view'

/** Только переключение художественной подложки; музыка здесь не запускается. */
export function MultimediaScene({ media }: { media: V2MediaRelease }) {
  const [view, setView] = useState<MediaView>(() => initialMediaView(media))
  return <MediaSceneView media={media} view={view} onViewChange={setView} />
}
