'use client'

import { useState } from 'react'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { toast } from 'sonner'
import { Eye, Edit3, Save, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { updatePassportAction } from '@/lib/actions/studio-characters'

interface PassportEditorProps {
  characterId: string
  passport: string | null
  characterName: string
  characterType: 'person' | 'city'
}

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

const PASSPORT_TEMPLATE_CITY = `# ПАСПОРТ ГОРОДА: [ИМЯ]

## Базовые параметры

| Параметр | Значение |
|---|---|
| Расположение | [описание] |
| Население | [число] |
| Принцип | [ключевой принцип] |
| Характер | [характер города] |
| Атмосфера | [атмосфера] |

---

## Физика города

### Свет и Время

[Как меняется свет, времена года]

### Запахи

[Ключевые запахи разных мест]

### Звуки

[Ключевые звуки]

---

## География и маршруты

### Главные оси

[Основные направления, перекрёстки]

---

## Транспорт

[Как перемещаются жители]

---

## Исторический фундамент

[История места, ключевые события]

---

## Оптика персонажей

| Персонаж | Как видит город |
|---|---|
| [Имя] | [описание] |

---

## Характер города как персонажа

[Город как живое существо]

---

## Скрытые связи

[Связи с другими произведениями и мирами]
`

export function PassportEditor({
  characterId,
  passport,
  characterType,
}: PassportEditorProps) {
  const [mode, setMode] = useState<'view' | 'edit'>(passport ? 'view' : 'edit')
  const [content, setContent] = useState(passport ?? '')
  const [saving, setSaving] = useState(false)

  const template = characterType === 'city' ? PASSPORT_TEMPLATE_CITY : PASSPORT_TEMPLATE_PERSON

  async function handleSave(formData: FormData) {
    setSaving(true)
    try {
      await updatePassportAction(characterId, formData)
      toast.success('Паспорт сохранён')
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения')
      setSaving(false)
    }
  }

  const passportLabel = characterType === 'city' ? 'Паспорт города' : 'Паспорт персонажа'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold uppercase tracking-widest text-red-600">{passportLabel}</h3>
          <span className="text-xs text-gray-400">Секретно · author + admin</span>
        </div>
        <div className="flex gap-2">
          {passport && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode(mode === 'view' ? 'edit' : 'view')}
              className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200"
            >
              {mode === 'view' ? <Edit3 className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
              {mode === 'view' ? 'Редактировать' : 'Просмотр'}
            </Button>
          )}
        </div>
      </div>

      {mode === 'edit' ? (
        <form action={handleSave} className="space-y-4">
          <input type="hidden" name="passport" value={content} />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={30}
            placeholder={template}
            className="bg-white/60 border-white/70 rounded-xl font-mono text-sm leading-6 min-h-[500px] resize-y"
          />
          {!passport && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setContent(template)}
              className="rounded-xl text-gray-500 hover:text-violet-600"
            >
              Заполнить шаблон
            </Button>
          )}
          <div className="flex justify-end gap-3">
            <Button type="submit" disabled={saving} className="rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md shadow-red-500/25 hover:from-red-700 hover:to-red-600">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Сохранение...' : 'Сохранить паспорт'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-5 md:p-6">
          {passport ? (
            <MarkdownRenderer
              content={passport}
              className="text-gray-900 [&_h1]:text-gray-900 [&_h2]:text-gray-900 [&_h3]:text-gray-800 [&_p]:text-gray-700 [&_strong]:text-gray-900 [&_em]:text-violet-600 [&_ul_li]:text-gray-700 [&_ol_li]:text-gray-700 [&_hr]:border-gray-200 [&_code]:bg-gray-100 [&_code]:text-violet-600"
            />
          ) : (
            <div className="py-8 text-center text-gray-400">
              <Lock className="mx-auto mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm">Паспорт ещё не заполнен</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode('edit')}
                className="mt-3 rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-violet-50 hover:text-violet-700"
              >
                <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                Создать паспорт
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
