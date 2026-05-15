import { useCallback, useState } from 'react'
import { useRevalidator } from 'react-router'

import type { SettingsSection } from '@/shared/settings'

import { useApiFetcher } from '@/client/api/fetcher'
import { API_ACTIONS } from '@/shared/api-actions'

const UPDATE = API_ACTIONS.admin.updateSettings

interface UseSettingsFetcherOptions {
  section: SettingsSection
  /** Reset the dirty form back to the saved snapshot after a successful save. */
  onSaved?: () => void
}

interface UseSettingsFetcherResult {
  save: (payload: unknown) => void
  /**
   * Re-run the settings layout loader so every form re-renders with the
   * server's current snapshot. Used by the "撤销更改" affordance to
   * blow away local edits without waiting for a save: the layout
   * loader returns the DB-backed bundle, the form's `useEffect`
   * watching the section prop fires, and both `snapshot` and `draft`
   * reset to the freshly-loaded values.
   */
  revert: () => void
  isPending: boolean
  status: 'idle' | 'saving' | 'saved' | 'error'
  errorMessage: string | null
}

// Shared fetcher logic for every settings form. Wraps the JSON channel
// against `updateSettings` and triggers a router-wide revalidation so
// the layout loader's snapshot is refreshed (which in turn re-renders
// the child route with the new values).
//
// The historical hand-rolled drain effect (`handledUpdateRef` + manual
// guard against `data` reference) is replaced by `useFetcherResult` —
// see `@/client/api/fetcher` for the shared "fire exactly once per
// response" semantics that prevent the revalidate snowball described in
// the original comment.
export function useSettingsFetcher({ section, onSaved }: UseSettingsFetcherOptions): UseSettingsFetcherResult {
  const revalidator = useRevalidator()

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const updateFetcher = useApiFetcher<{ section: string; payload: unknown }, { success: true }>(UPDATE, {
    onSuccess: () => {
      setStatus('saved')
      onSaved?.()
      void revalidator.revalidate()
    },
    onError: (error) => {
      setStatus('error')
      setErrorMessage(error.message)
    },
  })

  const save = useCallback(
    (payload: unknown) => {
      setStatus('saving')
      setErrorMessage(null)
      updateFetcher.submit({ section, payload })
    },
    [section, updateFetcher],
  )

  const revert = useCallback(() => {
    setStatus('idle')
    setErrorMessage(null)
    void revalidator.revalidate()
  }, [revalidator])

  return {
    save,
    revert,
    isPending: updateFetcher.isPending,
    status,
    errorMessage,
  }
}
