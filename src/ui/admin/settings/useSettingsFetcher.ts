import { useCallback, useEffect, useState } from 'react'
import { useFetcher, useRevalidator } from 'react-router'

import type { ResetSettingsOutput, UpdateSettingsOutput } from '@/client/api/action-types'
import type { SettingsSection } from '@/server/settings/schema'
import type { ApiEnvelope } from '@/shared/api-envelope'

import { API_ACTIONS } from '@/client/api/actions'

const UPDATE = API_ACTIONS.admin.updateSettings
const RESET = API_ACTIONS.admin.resetSettings

interface UseSettingsFetcherOptions {
  section: SettingsSection
  /** Reset the dirty form back to the saved snapshot after a successful save. */
  onSaved?: () => void
  /** Reset the dirty form back to the (just-restored) defaults after reset. */
  onReset?: () => void
}

interface UseSettingsFetcherResult {
  save: (payload: unknown) => void
  reset: () => void
  isPending: boolean
  status: 'idle' | 'saving' | 'saved' | 'error'
  errorMessage: string | null
}

// Shared fetcher logic for every settings form. Wraps the JSON channel
// against `updateSettings` / `resetSettings` and triggers a router-wide
// revalidation so the layout loader's snapshot is refreshed (which in
// turn re-renders the child route with the new values).
export function useSettingsFetcher({ section, onSaved, onReset }: UseSettingsFetcherOptions): UseSettingsFetcherResult {
  const updateFetcher = useFetcher<ApiEnvelope<UpdateSettingsOutput>>()
  const resetFetcher = useFetcher<ApiEnvelope<ResetSettingsOutput>>()
  const revalidator = useRevalidator()

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const save = useCallback(
    (payload: unknown) => {
      setStatus('saving')
      setErrorMessage(null)
      // `useFetcher.submit` types JSON bodies pretty narrowly; the
      // `{ section, payload }` envelope is exactly what `defineApiAction`
      // expects on the server, so cast it to the framework's loose
      // `SubmitTarget` type instead of fighting TypeScript.
      void updateFetcher.submit({ section, payload } as never, {
        method: UPDATE.method,
        encType: 'application/json',
        action: UPDATE.path,
      })
    },
    [section, updateFetcher],
  )

  const reset = useCallback(() => {
    setStatus('saving')
    setErrorMessage(null)
    void resetFetcher.submit({ section } as never, {
      method: RESET.method,
      encType: 'application/json',
      action: RESET.path,
    })
  }, [section, resetFetcher])

  // Drain update results.
  useEffect(() => {
    if (updateFetcher.state !== 'idle' || !updateFetcher.data) return
    if (updateFetcher.data.error) {
      setStatus('error')
      setErrorMessage(updateFetcher.data.error.message)
      return
    }
    if (updateFetcher.data.data) {
      setStatus('saved')
      onSaved?.()
      void revalidator.revalidate()
    }
  }, [updateFetcher.state, updateFetcher.data, onSaved, revalidator])

  // Drain reset results.
  useEffect(() => {
    if (resetFetcher.state !== 'idle' || !resetFetcher.data) return
    if (resetFetcher.data.error) {
      setStatus('error')
      setErrorMessage(resetFetcher.data.error.message)
      return
    }
    if (resetFetcher.data.data) {
      setStatus('saved')
      onReset?.()
      void revalidator.revalidate()
    }
  }, [resetFetcher.state, resetFetcher.data, onReset, revalidator])

  return {
    save,
    reset,
    isPending: updateFetcher.state !== 'idle' || resetFetcher.state !== 'idle',
    status,
    errorMessage,
  }
}
