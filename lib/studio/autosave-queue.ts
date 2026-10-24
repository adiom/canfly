export type SaveStatus = 'pending' | 'saving' | 'saved' | 'error'

/** Serialize writes, including edits made while a request is still running. */
export class AutosaveQueue<T extends object> {
  private latest: T
  private saved: string
  private status: SaveStatus = 'saved'
  private timer: ReturnType<typeof setTimeout> | null = null
  private running: Promise<void> | null = null
  private writing = false
  private listeners = new Set<() => void>()

  constructor(initial: T, private readonly save: (value: T) => Promise<void>) {
    this.latest = initial
    this.saved = JSON.stringify(initial)
  }

  getValue = () => this.latest
  getStatus = () => this.status
  private hasChanges = () => JSON.stringify(this.latest) !== this.saved
  isDirty = () => this.hasChanges() || this.writing
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private notify(status: SaveStatus) {
    this.status = status
    this.listeners.forEach(listener => listener())
  }

  update = (patch: Partial<T>) => {
    this.latest = { ...this.latest, ...patch }
    if (this.timer) clearTimeout(this.timer)
    this.notify(this.isDirty() ? 'pending' : 'saved')
    if (this.isDirty()) {
      this.timer = setTimeout(() => { void this.flush().catch(() => {}) }, 1500)
    }
  }

  flush = (): Promise<void> => {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.running) return this.running
    this.running = this.drain().finally(() => { this.running = null })
    return this.running
  }

  private async drain() {
    try {
      while (this.hasChanges()) {
        const value = this.latest
        this.writing = true
        this.notify('saving')
        await this.save(value)
        this.saved = JSON.stringify(value)
      }
      this.writing = false
      this.notify('saved')
    } catch (error) {
      this.writing = false
      this.notify('error')
      throw error
    }
  }
}
