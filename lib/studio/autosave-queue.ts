export type SaveStatus = 'pending' | 'saving' | 'saved' | 'error'
export type AutosaveResult<T> = void | { acknowledged: Partial<T>; error: Error }

export function autosavePatch<T extends object>(saved: T, value: T): Partial<T> {
  const patch: Partial<T> = {}
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (JSON.stringify(value[key]) !== JSON.stringify(saved[key])) patch[key] = value[key]
  }
  return patch
}

/** Serialize writes, including edits made while a request is still running. */
export class AutosaveQueue<T extends object> {
  private latest: T
  private saved: T
  private status: SaveStatus = 'saved'
  private timer: ReturnType<typeof setTimeout> | null = null
  private running: Promise<void> | null = null
  private writing = false
  private listeners = new Set<() => void>()

  constructor(initial: T, private readonly save: (value: T, patch: Partial<T>) => Promise<AutosaveResult<T>>) {
    this.latest = initial
    this.saved = initial
  }

  getValue = () => this.latest
  getSavedValue = () => this.saved
  getStatus = () => this.status
  private hasChanges = () => JSON.stringify(this.latest) !== JSON.stringify(this.saved)
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

  /** Replace the baseline after flushing and completing an external write. */
  reset = (value: T) => {
    this.latest = value
    this.saved = value
    this.notify('saved')
  }

  private async drain() {
    try {
      while (this.hasChanges()) {
        const value = this.latest
        this.writing = true
        this.notify('saving')
        const result = await this.save(value, autosavePatch(this.saved, value))
        if (result) {
          this.saved = { ...this.saved, ...result.acknowledged }
          if (value === this.latest) throw result.error
        } else {
          this.saved = value
        }
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
