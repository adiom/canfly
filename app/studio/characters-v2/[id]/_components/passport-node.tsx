'use client'

import { useState } from 'react'
import { Lock, FileText } from 'lucide-react'

import { Textarea } from '@/components/ui/textarea'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { savePassportAction } from '@/lib/actions/studio-characters-v2'
import { CharacterNode } from './character-node'
import { StatusBadge, inputClass } from './shared'
import { PassportVersionHistory } from './passport-version-history'
import { useAutosave } from './use-autosave'
import type { LifeState } from '@/lib/server/character-completeness'
import type { Character } from '@/lib/types'

const PASSPORT_TEMPLATE_PERSON = `# ПАСПОРТ: [ИМЯ]

## Кто она/он

[Краткое описание персонажа]

---

## Семья и биография

[История семьи, ключевые события]

---

## Голос

[Как персонаж мыслит, говорит, метафоры]

---

## Внешность

[Описание внешности]

---

## Ключевые предметы

- **[Предмет]** — [значение]

---

## Психология

[Главные внутренние узлы]

---

## Дар

[Способность, условия, цена]

---

## Работа

[Род деятельности, отношение к работе]

---

## Связи с другими персонажами

[Отношения с ключевыми персонажами]

---

## Сквозные мотивы

- [мотив 1]
- [мотив 2]

---

## Главное

[Суть персонажа в одном абзаце]
`

export function PassportNode({
  character,
  state,
  canEdit,
}: {
  character: Character
  state: LifeState
  /** author/admin — право писать паспорт. */
  canEdit: boolean
}) {
  const [content, setContent] = useState(character.passport ?? '')
  const template = PASSPORT_TEMPLATE_PERSON

  const status = useAutosave(
    content,
    canEdit ? (v) => savePassportAction(character.id, v) : async () => {},
    1200,
  )

  return (
    <CharacterNode
      id="passport"
      title="Паспорт"
      eyebrow="05 · паспорт"
      state={state}
      aside={
        <>
          {canEdit && <PassportVersionHistory characterId={character.id} />}
          <StatusBadge status={status} />
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2 text-[11px] text-neutral-400">
        <Lock className="h-3 w-3 text-red-400" />
        <span className="uppercase tracking-[0.18em]">Секретно · author + admin</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Markdown — писатель. */}
        <div className="space-y-2">
          <Textarea
            value={content}
            disabled={!canEdit}
            rows={26}
            onChange={(e) => setContent(e.target.value)}
            placeholder={template}
            className={`min-h-[60vh] font-mono text-sm leading-6 ${inputClass}`}
          />
          {!content && canEdit && (
            <button
              type="button"
              onClick={() => setContent(template)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-neutral-500 transition-colors hover:text-neutral-900"
            >
              <FileText className="h-3 w-3" />
              Заполнить шаблон
            </button>
          )}
        </div>

        {/* Предпросмотр — форматированный markdown. */}
        <div className="rounded-xl border border-neutral-200 bg-white/50 p-4">
          {content.trim() ? (
            <MarkdownRenderer
              content={content}
              className="prose prose-sm max-w-none prose-headings:text-neutral-900 prose-headings:font-medium prose-p:text-neutral-700 prose-strong:text-neutral-900 prose-blockquote:border-[#A78BFA] prose-blockquote:text-neutral-600 prose-code:rounded prose-code:bg-neutral-100 prose-code:text-neutral-800"
            />
          ) : (
            <p className="py-8 text-center text-[12px] text-neutral-400">
              Паспорт ещё не заполнен — напишите слева или вставьте шаблон.
            </p>
          )}
        </div>
      </div>
    </CharacterNode>
  )
}
