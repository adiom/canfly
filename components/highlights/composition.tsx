import Image from 'next/image'
import type { HighlightPublication } from '@/lib/highlights/types'

export function HighlightComposition({ quote, publication }: { quote: string; publication: HighlightPublication | null }) {
  return <div className="space-y-8">
    <blockquote className="border-l-2 border-cf-accent pl-6 font-serif text-2xl leading-relaxed">«{quote}»</blockquote>
    {publication?.note && <section><h2 className="mb-2 text-xs uppercase tracking-widest text-cf-text-3">Заметка читателя</h2><p className="whitespace-pre-wrap">{publication.note}</p></section>}
    {publication?.materials.filter(m => m.kind !== 'image').map(m => <section key={m.id} className="space-y-2">
      <p className="text-xs uppercase tracking-widest text-cf-text-3">{m.kind === 'explain' ? 'Объяснение' : m.kind === 'meaning' ? 'Интерпретация' : 'По мотивам фрагмента'} · {m.origin === 'ai' ? 'Создано с AI' : 'Текст читателя'}</p>
      <p className="whitespace-pre-wrap leading-7">{m.content}</p>
    </section>)}
    {publication?.materials.filter(m => m.kind === 'image' && m.image_url).map(m => <figure key={m.id}>
      <Image src={m.image_url!} alt={m.content || 'Иллюстрация по мотивам цитаты'} width={768} height={768} unoptimized className="h-auto max-h-[70vh] w-full object-contain" />
      <figcaption className="mt-2 text-sm text-cf-text-3">{m.content} {m.origin === 'ai' ? '· Создано с AI' : '· Изображение читателя'}</figcaption>
    </figure>)}
  </div>
}
