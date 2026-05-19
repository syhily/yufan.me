import type { z } from 'zod'

import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useMemo, useState } from 'react'
import { type DefaultValues, type FieldValues, type Resolver, type UseFormReturn, useForm } from 'react-hook-form'
import { useRevalidator } from 'react-router'

import type { SettingsSection } from '@/shared/config/settings'

import { orpc } from '@/client/api/client'
import { useMutation } from '@/client/api/query'

interface UseSettingsCardOptions<TSource, TState extends FieldValues> {
  section: SettingsSection
  source: TSource
  toState: (source: TSource) => TState
  fromState: (state: TState) => Record<string, unknown>
  schema?: z.ZodType<TState>
}

interface UseSettingsCardResult<TState extends FieldValues> {
  isEditing: boolean
  setIsEditing: (value: boolean) => void
  draft: TState
  form: UseFormReturn<TState>
  save: () => void
  cancel: () => void
  isPending: boolean
  status: 'idle' | 'saving' | 'saved' | 'error'
  errorMessage: string | null
}

export function useSettingsCard<TSource, TState extends FieldValues>({
  section,
  source,
  toState,
  fromState,
  schema,
}: UseSettingsCardOptions<TSource, TState>): UseSettingsCardResult<TState> {
  const [isEditing, setIsEditing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const revalidator = useRevalidator()

  const initialValues = useMemo(
    () => toState(source) as DefaultValues<TState>,
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [source],
  )

  const resolver = useMemo<Resolver<TState> | undefined>(() => {
    if (!schema) {
      return undefined
    }
    return zodResolver(schema as never) as Resolver<TState>
  }, [schema])

  const form = useForm<TState>({
    defaultValues: initialValues,
    resolver,
    mode: 'onBlur',
  })
  const { reset, handleSubmit, watch } = form
  const draft = watch() as TState

  // Re-seed form when source changes (after a save in another card, after revert, etc.)
  // Only when not editing to avoid clobbering the user's current edits.
  const [lastSourceSnapshot, setLastSourceSnapshot] = useState<TSource>(source)
  if (source !== lastSourceSnapshot) {
    setLastSourceSnapshot(source)
    if (!isEditing) {
      reset(initialValues)
    }
  }

  const updateMutation = useMutation({
    mutationFn: ({ section, payload }: { section: SettingsSection; payload: Record<string, unknown> }) =>
      orpc.admin.settings.update({ section, payload }),
    onSuccess: () => {
      setStatus('saved')
      setIsEditing(false)
      // Revalidate the route loader so the bundle refreshes with latest data
      void revalidator.revalidate()
    },
    onError: (error) => {
      setStatus('error')
      setErrorMessage(error.message)
    },
  })

  const save = useCallback(() => {
    const doSave = handleSubmit((values) => {
      setStatus('saving')
      setErrorMessage(null)
      const payload = fromState(values)
      updateMutation.mutate({ section, payload })
    })
    void doSave()
  }, [handleSubmit, fromState, section, updateMutation])

  const cancel = useCallback(() => {
    reset(initialValues)
    setIsEditing(false)
    setStatus('idle')
    setErrorMessage(null)
  }, [initialValues, reset])

  return {
    isEditing,
    setIsEditing,
    draft,
    form,
    save,
    cancel,
    isPending: updateMutation.isPending,
    status,
    errorMessage,
  }
}
