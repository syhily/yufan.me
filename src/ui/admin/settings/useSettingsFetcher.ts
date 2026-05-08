import { useCallback, useState } from 'react'
import { useFetcher, useRevalidator } from 'react-router'

import type { ApiEnvelope } from '@/shared/api-envelope'
import type { UpdateSettingsOutput } from '@/shared/api-types'
import type { SettingsSection } from '@/shared/settings'

import { useFetcherResult } from '@/client/api/fetcher'
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
  const updateFetcher = useFetcher<ApiEnvelope<UpdateSettingsOutput>>()
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

  useFetcherResult(updateFetcher, {
    action: UPDATE,
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

  const revert = useCallback(() => {
    // `revalidate()` re-fires every active loader (the settings layout
    // loader returns the bucketed `bundle`, which the surrounding form
    // re-snapshots on prop change). Clear the saved/error tag so the
    // bar doesn't keep showing "已保存" after the user explicitly
    // throws away local edits.
    setStatus('idle')
    setErrorMessage(null)
    void revalidator.revalidate()
  }, [revalidator])

  return {
    save,
    revert,
    isPending: updateFetcher.state !== 'idle',
    status,
    errorMessage,
  }
}
