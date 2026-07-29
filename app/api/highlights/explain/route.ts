import { streamText } from 'ai'
import { guardHighlightRequest, buildPrompt, HIGHLIGHT_MODEL } from '@/lib/ai/highlight-actions'

const INSTRUCTION =
  'Объясни следующий отрывок из книги простым и понятным языком — без потери смысла, красиво и кратко (2–3 предложения). Не говори "этот отрывок о...", просто объясни напрямую.'

export async function POST(req: Request) {
  const guard = await guardHighlightRequest(req, 'llm:explain')
  if (!guard.ok) return guard.response

  const result = streamText({
    model: HIGHLIGHT_MODEL as Parameters<typeof streamText>[0]['model'],
    prompt: buildPrompt(INSTRUCTION, guard.text),
    maxOutputTokens: 300,
  })

  return result.toTextStreamResponse()
}
