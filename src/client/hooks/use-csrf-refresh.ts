import { useEffect } from 'react'

import { readCsrfMeta, setCsrfToken } from '@/client/api/client'
import { orpcQuery, useMutation } from '@/client/api/query'

/** Re-fetch interval for the CSRF token (30 minutes). */
const REFRESH_INTERVAL_MS = 30 * 60 * 1000

/**
 * Keeps the in-memory CSRF token fresh for long-lived SPA sessions.
 *
 * On first mount the hook seeds the module-level token from the
 * server-rendered `<meta name="csrf-token">` tag. Afterwards it
 * periodically calls `csrf.refresh` to mint a new token + cookie pair
 * before the 4-hour cookie TTL expires.
 *
 * Mount once at the root of the application so every oRPC mutation
 * carries a valid `X-CSRF-Token` header regardless of how long the
 * tab has been open.
 */
export function useCsrfRefresh(enabled = true) {
  const { mutate } = useMutation({
    ...orpcQuery.csrf.refresh.mutationOptions(),
    onSuccess: (data) => {
      setCsrfToken(data.token)
    },
  })

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') {
      return
    }

    // Seed from the SSR meta tag on first client mount.
    const meta = readCsrfMeta()
    if (meta) {
      setCsrfToken(meta)
    }

    const id = setInterval(() => {
      mutate({})
    }, REFRESH_INTERVAL_MS)

    return () => clearInterval(id)
  }, [enabled, mutate])
}
