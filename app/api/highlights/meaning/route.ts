import { streamText } from 'ai'
import { guardHighlightRequest, buildPrompt, HIGHLIGHT_MODEL, HIGHLIGHT_STREAM_TIMEOUT } from '@/lib/ai/highlight-actions'

const INSTRUCTION =
  'Раскрой глубинный смысл следующего отрывка: что за ним скрывается, какие символы и образы используются, какие литературные приёмы, возможные отсылки к философии или культуре. Пиши живо и интересно, 3–4 предложения.'

export async function POST(req: Request) {
  const guard = await guardHighlightRequest(req, 'llm:meaning')
  if (!guard.ok) return guard.response

  const result = streamText({
    model: HIGHLIGHT_MODEL as Parameters<typeof streamText>[0]['model'],
    prompt: buildPrompt(INSTRUCTION, guard.text),
    maxOutputTokens: 350,
    abortSignal: req.signal,
    timeout: HIGHLIGHT_STREAM_TIMEOUT,
  })

  return result.toTextStreamResponse()
}
