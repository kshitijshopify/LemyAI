// In-memory TTL cache. Per server instance; swap for Redis/Upstash KV when traffic grows.
type Entry<T> = { value: T; expires: number };

export class TtlCache<T> {
  private map = new Map<string, Entry<T>>();
  private inflight = new Map<string, Promise<T>>();

  constructor(
    private ttlMs: number,
    private maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: T) {
    if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  /** Returns the cached value or computes it once, even under concurrent requests. */
  async getOrCreate(key: string, create: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
    const hit = this.get(key);
    if (hit !== undefined) return { value: hit, cached: true };
    const pending = this.inflight.get(key);
    if (pending) return { value: await pending, cached: true };
    const p = create();
    this.inflight.set(key, p);
    try {
      const value = await p;
      this.set(key, value);
      return { value, cached: false };
    } finally {
      this.inflight.delete(key);
    }
  }
}
