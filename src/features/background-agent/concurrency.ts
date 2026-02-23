export class Concurrency {
  private readonly running = new Map<string, number>()
  private readonly queues = new Map<string, string[]>()

  current(key: string): number {
    return this.running.get(key) ?? 0
  }

  enqueue(key: string, id: string): void {
    const queue = this.queues.get(key) ?? []
    queue.push(id)
    this.queues.set(key, queue)
  }

  next(key: string): string | undefined {
    const queue = this.queues.get(key)
    if (!queue || queue.length === 0) return undefined
    const id = queue.shift()
    if (queue.length === 0) {
      this.queues.delete(key)
    }
    return id
  }

  remove(key: string, id: string): boolean {
    const queue = this.queues.get(key)
    if (!queue) return false
    const index = queue.indexOf(id)
    if (index < 0) return false
    queue.splice(index, 1)
    if (queue.length === 0) this.queues.delete(key)
    return true
  }

  acquire(key: string): void {
    this.running.set(key, this.current(key) + 1)
  }

  release(key: string): void {
    const value = this.current(key) - 1
    if (value <= 0) {
      this.running.delete(key)
      return
    }
    this.running.set(key, value)
  }

  queued(key: string): number {
    return this.queues.get(key)?.length ?? 0
  }

  keys(): string[] {
    return [...new Set([...this.running.keys(), ...this.queues.keys()])]
  }
}
