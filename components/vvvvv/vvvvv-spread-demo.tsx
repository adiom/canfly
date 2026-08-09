'use client'

import { useCallback, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSpreadPagination } from '@/lib/reader/use-spread-pagination'

/**
 * Фрагмент, который посетитель листает на лендинге.
 * Отделён от логики намеренно: текст меняется без правки компонента.
 */
export const DEMO_EXCERPT = {
  title: 'Тихий режим',
  author: 'canfly',
  paragraphs: [
    'Утро начиналось с проверки. Не с окна, не с чайника — с проверки. Пальцы находили телефон раньше, чем глаза находили комнату, и первым, что видел Ким за день, был список того, что случилось без него.',
    'Ничего не случилось. Случилось четыреста сорок сообщений, и ни одно не было адресовано ему лично.',
    'Он читал их стоя, у самой кровати, пока не затекала рука. Потом откладывал телефон и обнаруживал, что не помнит ни строки. Это повторялось каждое утро с такой точностью, что перестало быть привычкой и стало устройством: механизм, в который он вставал, как деталь.',
    'На работе он делал шрифты. Настоящие, с засечками, которые полагалось выверять по неделе. Начальник называл это «активом», клиенты — «айдентикой», а Ким про себя — ремеслом, и стеснялся этого слова, потому что оно звучало старше, чем он.',
    'В ремесле было то, чего не было в списке: оно не заканчивалось само. Список кончался, когда кончались сообщения. Буква кончалась, когда Ким решал, что она кончилась. Разница была небольшой, но он держался за неё, как держатся за перила в темноте.',
    'Однажды он поймал себя на том, что читает роман так же, как ленту: глазами по диагонали, выхватывая имена. Он дошёл до сотой страницы и не смог сказать, где происходит действие. Не потому что автор не написал. Потому что Ким не был там ни секунды.',
    'Он закрыл книгу и долго сидел, положив на неё ладонь. Бумага была тёплой снизу, от батареи, и это оказалось единственным, что он за вечер по-настоящему заметил.',
    'Тогда он попробовал иначе. Он завёл правило: одна страница, но целиком. Если в конце страницы он не мог пересказать её вслух — читал заново. Первый вечер ушёл на четыре страницы. Второй — на шесть. К концу недели он читал медленнее, чем в школе, и помнил больше, чем за весь предыдущий год.',
    'Выяснилось, что у текста есть размер. Не количество знаков — размер, как у комнаты. В него можно войти и походить. Можно остановиться у окна. Можно вернуться на абзац назад и обнаружить, что фраза, которую ты пробежал, держала на себе всю главу.',
    'Лента такого не позволяла. Лента была не комнатой, а коридором, и в коридоре нельзя жить — по нему можно только идти, всё быстрее, потому что сзади подпирают.',
    'Ким не бросил телефон. Он был не из тех, кто бросает, и не верил людям, которые об этом объявляют. Он просто начал замечать разницу между тем, что он прочитал, и тем, через что он прошёл.',
    'К весне он мог сказать, в каком доме жила героиня и как пахла лестница. Он никогда там не был. Но теперь у него было место, куда можно вернуться, — и оно оказалось прочнее половины мест, где он бывал ногами.',
    'Это и была вся перемена. Не дисциплина, не отказ, не новая система. Просто текст перестал быть тем, что проходит мимо, и снова стал тем, где находишься.',
  ],
}

const FONT_SIZE = 18

export function VvvvvSpreadDemo() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // Геометрию берём из хука ридера, а номер страницы держим свой: его clamp
  // округляет разворот вниз до чётной страницы и при нечётном общем числе
  // прячет последнюю. На лендинге хвост фрагмента терять нельзя.
  const { pageCount, isSpread, pageWidth, gutter, spreadWidth } =
    useSpreadPagination(viewportRef, trackRef, FONT_SIZE, DEMO_EXCERPT.title)

  const [storedPage, setStoredPage] = useState(0)

  const step = isSpread ? 2 : 1
  const lastPage = isSpread
    ? Math.max(0, pageCount % 2 === 0 ? pageCount - 2 : pageCount - 1)
    : Math.max(0, pageCount - 1)

  // Пересчёт раскладки (ресайз, поворот, загрузка шрифтов) может оставить
  // сохранённую страницу за пределами нового диапазона. Приводим её к диапазону
  // при рендере, а не эффектом: эффект здесь дал бы лишний каскадный рендер.
  const clamped = Math.min(storedPage, lastPage)
  const page = isSpread && clamped % 2 !== 0 ? Math.max(0, clamped - 1) : clamped

  const canPrev = page > 0
  const canNext = page < lastPage

  const goPrev = useCallback(() => setStoredPage(Math.max(0, page - step)), [page, step])
  const goNext = useCallback(
    () => setStoredPage(Math.min(lastPage, page + step)),
    [lastPage, page, step],
  )

  // Стрелки перехватываем только когда разворот в фокусе — иначе демо
  // отбирало бы у страницы обычную прокрутку.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goPrev()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      goNext()
    }
  }

  const translate = page * (pageWidth + gutter)
  const lastVisible = Math.min(page + step, pageCount)
  const pageLabel =
    lastVisible > page + 1
      ? `${page + 1}–${lastVisible} из ${pageCount}`
      : `${page + 1} из ${pageCount}`

  return (
    <div className="vv-demo">
      {/* Поля книги живут здесь, а не в padding трека: хук считает шаг листания
          как pageWidth + gutter, и любой горизонтальный padding внутри трека
          рассинхронизировал бы колонки со страницами. */}
      <div className="mx-auto w-full max-w-[1200px] px-5 md:px-12">
        <div
          ref={viewportRef}
          role="group"
          aria-label="Разворот VVVVV с фрагментом текста"
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="relative h-[64vh] max-h-[620px] min-h-[440px] w-full overflow-hidden focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[18px] focus-visible:outline-[var(--vv-ochre)]"
        >
          {/* Единственная структурная метка — корешок. Листы не рисуем:
              книга проступает из темноты одной линией. */}
          {isSpread && (
            <div
              aria-hidden
              className="absolute inset-y-0 w-px"
              style={{ left: pageWidth + gutter / 2, backgroundColor: 'var(--vv-rule)' }}
            />
          )}

          <div
            ref={trackRef}
            className="vv-spread-track relative"
            style={{
              height: '100%',
              width: spreadWidth,
              columnCount: isSpread ? 2 : 1,
              columnGap: gutter,
              columnFill: 'auto',
              /* Только вертикальные поля: горизонтальные сдвинули бы колонки
                 относительно шага листания. */
              padding: '6px 0 18px',
              boxSizing: 'border-box',
              fontFamily: 'var(--font-ebgaramond), Georgia, serif',
              fontSize: FONT_SIZE,
              lineHeight: 1.75,
              color: 'var(--vv-ink-2)',
              textAlign: 'justify',
              hyphens: 'auto',
              transform: `translateX(-${translate}px)`,
            }}
          >
            <h3
              style={{
                columnSpan: 'all',
                margin: '0 0 4px',
                fontFamily: 'var(--font-cormorant), Georgia, serif',
                fontSize: '2em',
                lineHeight: 1.1,
                color: 'var(--vv-ink)',
                breakAfter: 'avoid',
              }}
            >
              {DEMO_EXCERPT.title}
            </h3>
            <p
              style={{
                columnSpan: 'all',
                margin: '0 0 22px',
                fontFamily: 'var(--font-geist-mono), monospace',
                fontSize: 10,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'var(--vv-ink-3)',
                breakAfter: 'avoid',
              }}
            >
              {DEMO_EXCERPT.author}
            </p>
            {DEMO_EXCERPT.paragraphs.map((paragraph, index) => (
              <p key={index} style={{ margin: '0 0 1em', textIndent: index === 0 ? 0 : '1.4em' }}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p
            aria-live="polite"
            className="font-mono text-[10px] uppercase tracking-[0.24em]"
            style={{ color: 'var(--vv-ink-3)' }}
          >
            {pageLabel}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canPrev}
              aria-label="Предыдущая страница"
              className="vv-page-button"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              aria-label="Следующая страница"
              className="vv-page-button"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
