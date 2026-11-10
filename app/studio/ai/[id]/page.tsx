import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Bot,
  ExternalLink,
  FileText,
  Gauge,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getStudioCharacterAiDetail } from '@/lib/actions/studio-character-ai'
import {
  CHARACTER_CHAT_REASON_HINTS,
} from '@/lib/ai/character-chat/availability'
import { CharacterAiSettingsForm } from '@/components/studio/character-ai-settings-form'
import {
  AiStatusBadge,
  formatAiCount,
  formatAiDateTime,
} from '@/components/studio/character-ai-status'

export const dynamic = 'force-dynamic'

/**
 * Карточка AI-настроек и диагностики одного персонажа. Тексты чужих
 * переписок не показываются: только агрегаты, время и код последней ошибки.
 */
export default async function StudioCharacterAiPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getStudioCharacterAiDetail(id)
  if (!detail) notFound()

  const { item } = detail
  const stats = item.stats

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <Button
        variant="ghost"
        asChild
        className="-ml-3 mb-4 rounded-xl text-gray-500 hover:bg-violet-50/50 hover:text-violet-600"
      >
        <Link href="/studio/ai">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Ко всем AI-персонажам
        </Link>
      </Button>

      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-white/80 bg-gradient-to-br from-violet-50 to-rose-50 shadow-lg shadow-black/5">
            {item.avatar ? (
              <Image src={item.avatar} alt={item.name} fill sizes="64px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-lg font-bold text-violet-400">
                {item.name[0]}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{item.name}</h1>
            <p className="text-sm text-gray-400">@{item.slug}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <AiStatusBadge reason={item.availability.reason} label={item.availability.label} />
              <span className="rounded-lg border border-gray-200/80 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                {item.replyMode === 'ai_auto' ? 'автоматический режим' : item.replyMode}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
          >
            <Link href={`/characters/${item.slug}/chat`} target="_blank">
              <MessageSquare className="mr-2 h-4 w-4" />
              Открыть чат
            </Link>
          </Button>
          {detail.canManage && (
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
            >
              <Link href={`/studio/characters/${item.id}/edit`}>
                <FileText className="mr-2 h-4 w-4" />
                Инструкция
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
          >
            <Link href={`/characters/${item.slug}`} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              Профиль
            </Link>
          </Button>
        </div>
      </header>

      <main className="space-y-8">
        <section
          id="state"
          aria-labelledby="state-heading"
          className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm shadow-black/5 backdrop-blur-md md:p-6"
        >
          <SectionTitle id="state-heading" icon={<Gauge className="h-4 w-4" />}>
            Состояние AI
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {item.availability.canGenerate ? 'Генерация разрешена' : 'Генерация не запускается'}
              </p>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                {CHARACTER_CHAT_REASON_HINTS[item.availability.reason]}
              </p>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label="Режим ответа" value={item.replyMode} mono />
              <Row
                label="Инструкция автора"
                value={item.hasInstruction ? `задана, ${formatAiCount(item.instructionLength)} симв.` : 'не задана'}
              />
              <Row
                label="Технические настройки"
                value={
                  item.settingsSource === 'character'
                    ? `revision ${item.settingsRevision}`
                    : 'defaults (запись не создана)'
                }
              />
              <Row
                label="Заблокировавшие читатели"
                value={detail.blockedOk ? formatAiCount(item.blockedReaders) : 'нет данных'}
              />
            </dl>
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-gray-400">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Значение вычислено тем же resolver, что использует страница чата, карточки
            и API. Панель не может показать «готов», если runtime откажет.
          </p>
        </section>

        <section
          id="settings"
          aria-labelledby="settings-heading"
          className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm shadow-black/5 backdrop-blur-md md:p-6"
        >
          <SectionTitle id="settings-heading" icon={<Bot className="h-4 w-4" />}>
            Технические параметры
          </SectionTitle>
          <p className="mb-5 text-sm leading-6 text-gray-500">
            Это только параметры вызова модели. Авторская инструкция, режим ответа и
            доступность остаются в существующих полях персонажа и здесь не
            дублируются.
          </p>
          <CharacterAiSettingsForm
            characterId={item.id}
            initial={{
              modelId: item.config.modelId,
              temperature: item.config.temperature,
              maxOutputTokens: item.config.maxOutputTokens,
              totalTimeoutMs: item.config.totalTimeoutMs,
              chunkTimeoutMs: item.config.chunkTimeoutMs,
              userTurnsPerHour: item.config.userTurnsPerHour,
            }}
            canManage={detail.canManage}
            schema={detail.schema}
            updatedAt={detail.settingsUpdatedAt}
          />
        </section>

        <section
          id="diagnostics"
          aria-labelledby="diagnostics-heading"
          className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm shadow-black/5 backdrop-blur-md md:p-6"
        >
          <SectionTitle id="diagnostics-heading" icon={<MessageSquare className="h-4 w-4" />}>
            Диагностика диалогов
          </SectionTitle>

          {!detail.statsOk ? (
            <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
              Сводка не загрузилась. Все значения ниже — «нет данных», а не нули.
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Metric label="Диалоги" value={formatAiCount(stats.conversations)} />
                <Metric label="Читатели" value={formatAiCount(stats.readers)} />
                <Metric label="Сообщения" value={formatAiCount(stats.messages)} />
                <Metric label="Ответы" value={formatAiCount(stats.answers)} />
                <Metric label="Обращения, 30 дней" value={formatAiCount(stats.requestsLast30d)} />
                <Metric label="Успешные, 30 дней" value={formatAiCount(stats.completedLast30d)} />
                <Metric label="Ошибки, 30 дней" value={formatAiCount(stats.failedLast30d)} />
                <Metric label="Активные ходы" value={formatAiCount(stats.pendingNow)} />
              </dl>

              <div className="mt-5 grid gap-4 border-t border-black/5 pt-4 sm:grid-cols-2">
                <div className="space-y-2 text-sm">
                  <Row label="Последний сохранённый ответ" value={formatAiDateTime(stats.lastAnswerAt)} />
                  <Row
                    label="Последняя ошибка"
                    value={
                      item.lastError
                        ? `${item.lastError.code ?? 'без кода'} · ${formatAiDateTime(item.lastError.at)}`
                        : 'нет данных'
                    }
                  />
                  <Row
                    label="Usage"
                    value={
                      stats.inputTokens === null
                        ? 'нет данных: провайдер не сообщил токены'
                        : `вход ${formatAiCount(stats.inputTokens)}, выход ${formatAiCount(stats.outputTokens)}`
                    }
                  />
                  <Row
                    label="Ответы без usage"
                    value={formatAiCount(stats.unmeteredAnswers)}
                  />
                </div>
                <div className="rounded-xl border border-black/5 bg-white/50 p-4 text-xs leading-5 text-gray-500">
                  <p className="font-semibold text-gray-700">Что здесь не считается</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>Стоимость: тариф провайдера и валюта в данных не заданы.</li>
                    <li>Качество ответа: это счётчики, а не авторская оценка.</li>
                    <li>Тексты переписок: доступ к ним требует отдельного решения и аудита.</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </section>

        <section
          id="instruction"
          aria-labelledby="instruction-heading"
          className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm shadow-black/5 backdrop-blur-md md:p-6"
        >
          <SectionTitle id="instruction-heading" icon={<FileText className="h-4 w-4" />}>
            Авторская инструкция
          </SectionTitle>
          <p className="text-sm leading-6 text-gray-500">
            {item.hasInstruction
              ? `В characters.system_role задана инструкция (${formatAiCount(item.instructionLength)} симв.). Здесь она не редактируется и не копируется во вторую таблицу.`
              : 'characters.system_role пуст: чат не запускает генерацию. Инструкция задаётся в карточке персонажа существующим редактором.'}
          </p>
          {detail.canManage && (
            <Button
              asChild
              variant="outline"
              className="mt-4 rounded-xl border-white/70 bg-white/60 text-gray-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
            >
              <Link href={`/studio/characters/${item.id}/edit`}>
                <FileText className="mr-2 h-4 w-4" />
                Открыть редактор персонажа
              </Link>
            </Button>
          )}
        </section>
      </main>
    </div>
  )
}

function SectionTitle({
  id,
  icon,
  children,
}: {
  id: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <h2
      id={id}
      className="mb-4 flex items-center gap-2 text-[12px] uppercase tracking-[0.28em] text-gray-500"
    >
      <span className="text-violet-400">{icon}</span>
      {children}
    </h2>
  )
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-gray-400">{label}</dt>
      <dd className={`text-right text-gray-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-gray-400">{label}</dt>
      <dd className="mt-1 text-xl font-bold text-gray-900">{value}</dd>
    </div>
  )
}
