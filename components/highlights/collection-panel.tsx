'use client'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { HighlightCollection } from './collection'
export function HighlightCollectionPanel({ editionId, onClose }: { editionId: string; onClose: () => void }) {
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}><DialogContent className="max-h-[90dvh] overflow-y-auto bg-cf-bg sm:max-w-xl"><DialogTitle className="sr-only">Пометки книги</DialogTitle><HighlightCollection editionId={editionId} /></DialogContent></Dialog>
}
