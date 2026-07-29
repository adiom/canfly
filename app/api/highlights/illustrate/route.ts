import { generateText } from 'ai'
import { guardHighlightRequest, buildPrompt, HIGHLIGHT_MODEL } from '@/lib/ai/highlight-actions'

const INSTRUCTION =
  'На основе этого литературного отрывка создай короткий промпт (до 60 слов) для генерации иллюстрации в стиле dark arthouse, book illustration, ink and watercolor. Только промпт, без объяснений.'

export async function POST(req: Request) {
  const guard = await guardHighlightRequest(req, 'llm:illustrate')
  if (!guard.ok) return guard.response

  const { text } = guard

  const sdUrl = process.env.STABLE_DIFFUSION_URL
  if (!sdUrl) {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }

  // Генерируем art-промпт из текста через GPT
  let artPrompt: string
  try {
    const { text: promptText } = await generateText({
      model: HIGHLIGHT_MODEL as Parameters<typeof generateText>[0]['model'],
      prompt: buildPrompt(INSTRUCTION, text.slice(0, 400)),
      maxOutputTokens: 120,
    })
    artPrompt = promptText.trim()
  } catch {
    return Response.json({ error: 'prompt generation failed' }, { status: 500 })
  }

  // Вызов Stable Diffusion API
  try {
    const sdApiKey = process.env.SD_API_KEY
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
    })

    if (!sdRes.ok) {
      return Response.json({ error: 'generation failed' }, { status: 502 })
    }

    const sdData = await sdRes.json() as { images?: string[]; image?: string; url?: string }
    const imageData = sdData.images?.[0] ?? sdData.image ?? sdData.url

    if (!imageData) {
      return Response.json({ error: 'no image returned' }, { status: 502 })
    }

    // imageData может быть base64 или URL
    const imageUrl = imageData.startsWith('http') ? imageData : `data:image/png;base64,${imageData}`
    return Response.json({ imageUrl, prompt: artPrompt })
  } catch {
    return Response.json({ error: 'generation failed' }, { status: 502 })
  }
}
