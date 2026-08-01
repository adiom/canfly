import { generateText } from 'ai'
import { z } from 'zod'
import { guardHighlightRequest, buildPrompt, HIGHLIGHT_MODEL, highlightAiError } from '@/lib/ai/highlight-actions'

const INSTRUCTION =
  'На основе этого литературного отрывка создай короткий промпт (до 60 слов) для генерации иллюстрации в стиле dark arthouse, book illustration, ink and watercolor. Только промпт, без объяснений.'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const sdResponseSchema = z.object({
  images: z.array(z.string()).optional(),
  image: z.string().optional(),
  url: z.string().url().optional(),
})

export async function POST(req: Request) {
  const guard = await guardHighlightRequest(req, 'llm:illustrate')
  if (!guard.ok) return guard.response

  const { text } = guard

  const sdUrl = process.env.STABLE_DIFFUSION_URL
  if (!sdUrl) {
    return highlightAiError('unavailable', 503)
  }

  // Генерируем art-промпт из текста через GPT
  let artPrompt: string
  try {
    const { text: promptText } = await generateText({
      model: HIGHLIGHT_MODEL as Parameters<typeof generateText>[0]['model'],
      prompt: buildPrompt(INSTRUCTION, text.slice(0, 400)),
      maxOutputTokens: 120,
      abortSignal: req.signal,
      timeout: 20_000,
    })
    artPrompt = promptText.trim()
  } catch (error) {
    if (req.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return highlightAiError('timeout', 504)
    return highlightAiError('provider_error', 502)
  }

  // Вызов Stable Diffusion API
  try {
    const sdApiKey = process.env.SD_API_KEY
    const sdController = new AbortController()
    const timeout = setTimeout(() => sdController.abort(), 45_000)
    const abort = () => sdController.abort()
    req.signal.addEventListener('abort', abort, { once: true })
    const sdRes = await fetch(sdUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sdApiKey ? { Authorization: `Bearer ${sdApiKey}` } : {}),
      },
      body: JSON.stringify({
        prompt: artPrompt + ', dark arthouse, high quality illustration',
        negative_prompt: 'nsfw, realistic photo, blurry',
        width: 512,
        height: 512,
        steps: 20,
      }),
      signal: sdController.signal,
    })
    clearTimeout(timeout)
    req.signal.removeEventListener('abort', abort)

    if (!sdRes.ok) {
      return highlightAiError('provider_error', 502)
    }

    const contentLength = Number(sdRes.headers.get('content-length') ?? 0)
    if (contentLength > MAX_IMAGE_BYTES * 1.5) return highlightAiError('invalid_response', 502)
    const parsed = sdResponseSchema.safeParse(await sdRes.json())
    if (!parsed.success) return highlightAiError('invalid_response', 502)
    const sdData = parsed.data
    const imageData = sdData.images?.[0] ?? sdData.image ?? sdData.url

    if (!imageData) {
      return highlightAiError('invalid_response', 502)
    }

    if (!imageData.startsWith('http') && imageData.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 16) {
      return highlightAiError('invalid_response', 502)
    }

    // imageData может быть base64 или URL
    const imageUrl = imageData.startsWith('http') ? imageData : `data:image/png;base64,${imageData}`
    return Response.json({ imageUrl, prompt: artPrompt })
  } catch (error) {
    if (req.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return highlightAiError('timeout', 504)
    return highlightAiError('provider_error', 502)
  }
}
