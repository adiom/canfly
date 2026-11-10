/** Preserve UTF-8 characters split across network chunks. */
export async function* readTextStream(stream: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let ended = false
  const abort = () => { void reader.cancel(signal?.reason).catch(() => undefined) }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    if (signal?.aborted) throw signal.reason
    while (true) {
      const { done, value } = await reader.read()
      if (signal?.aborted) throw signal.reason
      if (done) { ended = true; break }
      const text = decoder.decode(value, { stream: true })
      if (text) yield text
    }
    const tail = decoder.decode()
    if (tail) yield tail
  } finally {
    signal?.removeEventListener('abort', abort)
    if (!ended) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
