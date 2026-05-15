import { useCallback, useState } from 'react'
import { useRevalidator } from 'react-router'

import type { SettingsSection } from '@/shared/settings'

import { api } from '@/client/api/client'
import { useApiMutation } from '@/client/api/query'
import { unwrap } from '@/client/api/unwrap'

interface UseSettingsFetcherOptions {
  section: SettingsSection
  onSaved?: () => void
}

interface UseSettingsFetcherResult {
  save: (payload: unknown) => void
  revert: () => void
  isPending: boolean
  status: 'idle' | 'saving' | 'saved' | 'error'
  errorMessage: string | null
}

export function useSettingsFetcher({ section, onSaved }: UseSettingsFetcherOptions): UseSettingsFetcherResult {
  const revalidator = useRevalidator()

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const updateMutation = useApiMutation(
    (input: { section: SettingsSection; payload: unknown }) =>
      unwrap(api.admin.settings.updateSettings({ body: input })),
    {
      onSuccess: () => {
        setStatus('saved')
        onSaved?.()
        void revalidator.revalidate()
      },
      onError: (error) => {
        setStatus('error')
        setErrorMessage(error.message)
      },
    },
  )

  const save = useCallback(
    (payload: unknown) => {
      setStatus('saving')
      setErrorMessage(null)
      updateMutation.mutate({ section, payload })
    },
    [section, updateMutation],
  )

  const revert = useCallback(() => {
    setStatus('idle')
    setErrorMessage(null)
    void revalidator.revalidate()
  }, [revalidator])

  return {
    save,
    revert,
    isPending: updateMutation.isPending,
    status,
    errorMessage,
  }
}
