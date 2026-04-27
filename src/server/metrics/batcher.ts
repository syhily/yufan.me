import { incrementPageViewsBatch } from '@/server/db/query/page'
import { getLogger } from '@/server/logger'

// In-memory aggregator for high-frequency counters. We currently track page
// views (every request to a post page bumps the same counter) but the same
// pattern could apply to other "fire and forget" stats.
//
// Flush triggers:
//  - The buffered count for any single key reaches `flushThreshold`.
//  - Time since last flush exceeds `flushIntervalMs` (lazy timer set on the
//    first increment after a flush).
//  - The Node process gets SIGTERM/SIGINT/exit (best-effort flush).
//
// Note: in dev React Router may re-evaluate server modules on every request,
// which would create multiple batchers — we guard by attaching the instance
// to globalThis to keep one per process.

interface BatcherOptions {
  flushIntervalMs: number
  flushThreshold: number
}

const log = getLogger('metrics.batcher')

class PageViewBatcher {
  private buffer = new Map<string, number>()
  private timer: NodeJS.Timeout | null = null
  private flushing: Promise<void> | null = null

  constructor(private readonly opts: BatcherOptions) {
    const onShutdown = () => {
      void this.flush().catch((err) => log.error('flush on shutdown failed', { err: String(err) }))
    }
    process.once('SIGTERM', onShutdown)
    process.once('SIGINT', onShutdown)
    process.once('beforeExit', onShutdown)
  }

  increment(key: string): void {
    const next = (this.buffer.get(key) ?? 0) + 1
    this.buffer.set(key, next)

    if (next >= this.opts.flushThreshold) {
      void this.flush()
      return
    }

    if (this.timer === null) {
      this.timer = setTimeout(() => {
        void this.flush()
      }, this.opts.flushIntervalMs)
      // Don't keep the event loop alive solely for this timer.
      this.timer.unref?.()
    }
  }

  async flush(): Promise<void> {
    if (this.flushing) {
      return this.flushing
    }
    if (this.buffer.size === 0) {
      return
    }

    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    const snapshot = this.buffer
    this.buffer = new Map()

    this.flushing = (async () => {
      try {
        await incrementPageViewsBatch(snapshot)
        log.debug('flushed page views', { keys: snapshot.size })
      } catch (err) {
        log.error('flush failed; restoring buffer', { err: String(err), keys: snapshot.size })
        // Restore any counts that were lost so we try again on the next tick.
        for (const [k, v] of snapshot) {
          this.buffer.set(k, (this.buffer.get(k) ?? 0) + v)
        }
      } finally {
        this.flushing = null
      }
    })()

    return this.flushing
  }
}

const GLOBAL_KEY = Symbol.for('yufan.me/metrics-batcher')
type Holder = { [GLOBAL_KEY]?: PageViewBatcher }
const holder = globalThis as Holder

function getBatcher(): PageViewBatcher {
  if (!holder[GLOBAL_KEY]) {
    holder[GLOBAL_KEY] = new PageViewBatcher({
      flushIntervalMs: 60_000,
      flushThreshold: 50,
    })
  }
  return holder[GLOBAL_KEY]!
}

// Single source of truth for the PROD-only view-counter increment. Wrappers
// upstream used to gate this with `import.meta.env.PROD`; centralising the
// guard here keeps every bump call site (loader, page-data, future routes)
// consistent and makes flushing a no-op outside production.
export function bumpPageView(key: string): void {
  if (!import.meta.env.PROD) {
    return
  }
  getBatcher().increment(key)
}

export function flushPageViews(): Promise<void> {
  return getBatcher().flush()
}
