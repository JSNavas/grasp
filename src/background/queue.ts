export class QueueBusyError extends Error {
  readonly retryable = true
}

export class RateLimitedQueue {
  private running = 0
  private readonly pending: Array<() => void> = []
  private readonly timestamps: number[] = []

  constructor(
    private readonly rpm: number,
    private readonly concurrency: number,
    private readonly maxWaitMs = 4_000,
  ) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await task()
    } finally {
      this.release()
    }
  }

  private async acquire(): Promise<void> {
    while (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.pending.push(resolve))
    }
    this.running++

    try {
      const now = Date.now()
      while (this.timestamps.length && now - this.timestamps[0] > 60_000) {
        this.timestamps.shift()
      }
      if (this.timestamps.length >= this.rpm) {
        const waitMs = 60_000 - (now - this.timestamps[0]) + 50
        if (waitMs > this.maxWaitMs) {
          const secs = Math.ceil(waitMs / 1000)
          throw new QueueBusyError(`Limite de ${this.rpm}/min alcanzado. Reintenta en ${secs}s.`)
        }
        await sleep(waitMs)
      }
      this.timestamps.push(Date.now())
    } catch (err) {
      this.release()
      throw err
    }
  }

  private release(): void {
    this.running--
    this.pending.shift()?.()
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
