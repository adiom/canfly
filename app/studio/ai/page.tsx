import Link from 'next/link'
import Image from 'next/image'
import { Bot, ChevronRight, CircleAlert, Database, Users } from 'lucide-react'

import { getStudioCharacterAiOverview } from '@/lib/actions/studio-character-ai'
import {
  AiStatusBadge,
  formatAiCount,
  formatAiDateTime,
} from '@/components/studio/character-ai-status'

export const dynamic = 'force-dynamic'

const REPLY_MODE_LABELS: Record<string, string> = {
  ai_auto: 'AI авто',
  manual: 'Вручную',
  hybrid: 'AI + проверка',
  disabled: 'Отключено',
}

/**
 * Единый AI-центр внутри существующей Studio. Показывает только достоверные
 * агрегаты и техническую конфигурацию; авторская инструкция остаётся в
 * карточке персонажа.
 */
export default async function StudioAiPage() {
  const overview = await getStudioCharacterAiOverview()
  const ready = overview.items.filter((item) => item.availability.canGenerate).length
  const attention = overview.items.length - ready
  const conversationReaders = overview.items.reduce((sum, item) => sum + item.stats.readers, 0)
  const blockedReaders = overview.items.reduce((sum, item) => sum + item.blockedReaders, 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-500">
          <Bot className="h-4 w-4" />
          Studio · AI
        </div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">AI-чат персонажей</h1>
            <p className="mt-1 max-w-3xl text-gray-500">
              Единое состояние встроенных чатов: доступность, модель, технические
              параметры и диагностика. Авторская инструкция по-прежнему одна —
              <span className="font-mono text-xs text-gray-600"> characters.system_role</span>.
            </p>
          </div>
          <Link
            href="/studio/characters"
            className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/60 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
          >
            <Users className="h-4 w-4" />
            Карточки персонажей
          </Link>
        </div>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Персонажей" value={formatAiCount(overview.items.length)} />
        <SummaryCard label="Отвечают автоматически" value={formatAiCount(ready)} tone="emerald" />
        <SummaryCard
          label="Требуют внимания"
          value={formatAiCount(attention)}
          tone={attention > 0 ? 'amber' : 'gray'}
        />
      </div>

      {!overview.statsOk && (
        <Notice tone="amber">
          Сводка activity не загрузилась. Значения ниже показаны как «нет данных»,
          а не как нули. Проверьте серверный лог и подключение к БД.
        </Notice>
      )}

      {overview.schema !== 'available' && (
        <Notice tone={overview.schema === 'missing' ? 'amber' : 'red'}>
          <span className="flex items-start gap-2">
            <Database className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Схема <code className="font-mono">character_ai_settings</code>{' '}
              {overview.schema === 'missing'
                ? 'не установлена: используются defaults, сохранение настроек недоступно.'
                : 'недоступна из-за ошибки чтения: используются defaults.'}{' '}
              Аддитивная миграция —{' '}
              <code className="font-mono">postgres/033_character_ai_settings.sql</code>.
            </span>
          </span>
        </Notice>
      )}

      <p className="mb-6 flex items-start gap-2 text-xs leading-5 text-gray-400">
        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Стоимость не рассчитывается: в metadata нет тарифа провайдера. Показаны
        только фактические usage-токены там, где провайдер их сообщил; старые
        ответы без usage помечены как неизвестные.
      </p>

      {overview.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200/80 bg-white/30 py-16 text-center">
          <Bot className="mx-auto mb-3 h-8 w-8 text-violet-300" />
          <p className="font-semibold text-gray-700">Персонажей пока нет</p>
          <p className="mt-1 text-sm text-gray-400">
            AI-панель появится, когда в Studio будет создан первый персонаж.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {overview.items.map((item) => (
            <Link key={item.id} href={`/studio/ai/${item.id}`} className="group block">
              <article className="h-full rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm shadow-black/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-white/90 hover:bg-white/80 hover:shadow-md hover:shadow-black/10">
                <div className="flex items-start gap-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-white/80 bg-gradient-to-br from-violet-50 to-rose-50 shadow-sm">
                    {item.avatar ? (
                      <Image
                        src={item.avatar}
                        alt={item.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-lg font-bold text-violet-400">
                        {item.name[0]}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-gray-900 transition-colors group-hover:text-violet-700">
                          {item.name}
                        </h2>
                        <p className="truncate text-xs tracking-wide text-gray-400">
                          @{item.slug}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500" />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <AiStatusBadge
                        reason={item.availability.reason}
                        label={item.availability.label}
                      />
                      <span className="rounded-lg border border-gray-200/80 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                        {REPLY_MODE_LABELS[item.replyMode] ?? item.replyMode}
                      </span>
                      {item.blockedReaders > 0 && (
                        <span className="rounded-lg border border-red-200/80 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-600">
                          блокировок: {item.blockedReaders}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                  <Stat label="Диалоги" value={item.statsAvailable ? formatAiCount(item.stats.conversations) : 'нет данных'} />
                  <Stat label="Читатели" value={item.statsAvailable ? formatAiCount(item.stats.readers) : 'нет данных'} />
                  <Stat label="Обращения 30д" value={item.statsAvailable ? formatAiCount(item.stats.requestsLast30d) : 'нет данных'} />
                  <Stat label="Ошибки 30д" value={item.statsAvailable ? formatAiCount(item.stats.failedLast30d) : 'нет данных'} />
                </dl>

                <div className="mt-4 space-y-1.5 border-t border-black/5 pt-3 text-xs leading-5 text-gray-500">
                  <p>
                    <span className="text-gray-400">Модель:</span>{' '}
                    <span className="font-mono text-[11px] text-gray-700">{item.config.modelId}</span>
                    <span className="ml-2 text-gray-400">
                      · temp {item.config.temperature}
                      · output {item.config.maxOutputTokens}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-400">Инструкция:</span>{' '}
                    {item.hasInstruction
                      ? `задана (${item.instructionLength.toLocaleString('ru-RU')} симв.)`
                      : 'не задана'}
                    <span className="ml-2 text-gray-400">
                      · {item.settingsSource === 'character' ? `revision ${item.settingsRevision}` : 'defaults'}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-400">Последний ответ:</span>{' '}
                    {item.statsAvailable ? formatAiDateTime(item.stats.lastAnswerAt) : 'нет данных'}
                    <span className="ml-3 text-gray-400">Последняя ошибка:</span>{' '}
                    {item.lastError
                      ? `${item.lastError.code ?? 'без кода'} · ${formatAiDateTime(item.lastError.at)}`
                      : 'нет данных'}
                  </p>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-gray-400">
        Всего читателей с диалогами: {overview.statsOk ? conversationReaders.toLocaleString('ru-RU') : 'нет данных'}.
        Заблокировавших героя: {overview.statsOk ? blockedReaders.toLocaleString('ru-RU') : 'нет данных'}.
        Содержимое чужих переписок здесь не открывается.
      </p>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone = 'gray',
}: {
  label: string
  value: string
  tone?: 'gray' | 'emerald' | 'amber'
}) {
  const tones = {
    gray: 'text-gray-900',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
  } as const
  return (
    <div className="rounded-2xl border border-white/70 bg-white/60 px-5 py-4 shadow-sm shadow-black/5 backdrop-blur-md">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-gray-400">{label}</dt>
      <dd className="mt-0.5 font-semibold text-gray-800">{value}</dd>
    </div>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: 'amber' | 'red'
  children: React.ReactNode
}) {
  const className =
    tone === 'amber'
      ? 'border-amber-200/80 bg-amber-50/80 text-amber-800'
      : 'border-red-200/80 bg-red-50/80 text-red-700'
  return (
    <div className={`mb-5 rounded-xl border px-4 py-3 text-sm leading-6 ${className}`}>
      {children}
    </div>
  )
}
