import { useEffect, useRef, useState } from 'react'

import type { RealtimeEvent } from '@/shared/contracts/analytics'

// EventSource subscription hook for the realtime tail. Maintains a
// rolling buffer of the latest `bufferSize` events and exposes the
// connection state so the UI can show a "connecting / live / lost"
// pip. Auto-reconnects with exponential backoff handled by the
// browser's EventSource implementation — we only retry on
// `onerror` after the underlying socket gave up.

export interface UseEventStreamOptions {
  bufferSize?: number
  enabled?: boolean
}

export function useEventStream({ bufferSize = 100, enabled = true }: UseEventStreamOptions = {}) {
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [state, setState] = useState<'connecting' | 'live' | 'lost'>('connecting')
  const lastSeenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
      return
    }

    const url = new URL('/api/analytics/events', window.location.origin)
    if (lastSeenRef.current) {
      url.searchParams.set('since', lastSeenRef.current)
    }
    const source = new EventSource(url.toString(), { withCredentials: true })

    setState('connecting')
    source.onopen = () => setState('live')
    source.onerror = () => setState('lost')

    source.addEventListener('events', (raw) => {
      try {
        const incoming = JSON.parse((raw as MessageEvent).data) as RealtimeEvent[]
        if (incoming.length === 0) {
          return
        }
        lastSeenRef.current = incoming[incoming.length - 1]!.ts
        setEvents((prev) => {
          const next = [...prev, ...incoming]
          return next.length > bufferSize ? next.slice(next.length - bufferSize) : next
        })
      } catch {
        // bad payload — skip
      }
    })

    return () => {
      source.close()
    }
  }, [bufferSize, enabled])

  return { events, state }
}
