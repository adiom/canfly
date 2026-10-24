/** Preserve UTF-8 characters split across network chunks. */
export async function* readTextStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      if (text) yield text
    }
    const tail = decoder.decode()
    if (tail) yield tail
  } finally {
    reader.releaseLock()
  }
}
