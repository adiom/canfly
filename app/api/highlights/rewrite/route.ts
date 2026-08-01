import { streamText } from 'ai'
import { z } from 'zod'
import { guardHighlightRequest, buildPrompt, HIGHLIGHT_MODEL, HIGHLIGHT_STREAM_TIMEOUT } from '@/lib/ai/highlight-actions'

const MODES = {
  'другой-финал': 'Перепиши сцену так, чтобы она закончилась иначе — неожиданно и интересно',
  'другая-эпоха': 'Перепиши этот отрывок, перенеся действие в другую историческую эпоху — сохрани суть, но измени антураж',
  'другой-стиль': 'Перепиши этот отрывок в совершенно другом литературном стиле — например, как детектив, магический реализм или абсурдизм',
} as const

const modeSchema = z.enum(Object.keys(MODES) as [keyof typeof MODES, ...(keyof typeof MODES)[]])

export async function POST(req: Request) {
  // Тело читается один раз, поэтому mode достаём из клона до общей проверки
  const modeCandidate = await req
    .clone()
    .json()
    .then((body: unknown) => (body as { mode?: unknown })?.mode)
    .catch(() => undefined)

  const mode = modeSchema.safeParse(modeCandidate)
  if (!mode.success) {
    return Response.json({ error: 'Неизвестный режим' }, { status: 400 })
  }

  const guard = await guardHighlightRequest(req, 'llm:rewrite')
  if (!guard.ok) return guard.response

  const instruction = `${MODES[mode.data]}. Пиши увлекательно, не объясняй своих действий — просто напиши переработанный текст (3–6 предложений).`

  const result = streamText({
    model: HIGHLIGHT_MODEL as Parameters<typeof streamText>[0]['model'],
    prompt: buildPrompt(instruction, guard.text),
    maxOutputTokens: 400,
    abortSignal: req.signal,
    timeout: HIGHLIGHT_STREAM_TIMEOUT,
  })

  return result.toTextStreamResponse()
}
