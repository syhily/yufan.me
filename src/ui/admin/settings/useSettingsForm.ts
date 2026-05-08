import type { z } from 'zod'

import { zodResolver } from '@hookform/resolvers/zod'
import { type SubmitEventHandler, useCallback, useEffect, useMemo } from 'react'
import { type DefaultValues, type FieldValues, type Resolver, type UseFormReturn, useForm } from 'react-hook-form'

import type { SettingsSection } from '@/shared/settings'

import { useSettingsFetcher } from '@/ui/admin/settings/useSettingsFetcher'

interface UseSettingsFormOptions<TSource, TState extends FieldValues> {
  /** Per-section identifier shared with the perimeter (`SettingsSection`). */
  section: SettingsSection
  /** Server snapshot from the layout loader (`bundle.<section>` DTO). */
  source: TSource
  /** Project the server snapshot into editable form state. */
  toState: (source: TSource) => TState
  /** Project the editable form state into the wire payload sent to `updateSettings`. */
  fromState: (state: TState) => unknown
  /**
   * Optional client-side validation schema. When provided, RHF runs
   * `zodResolver(schema)` on every blur (and on submit) so individual
   * field errors surface inline before the server round-trip. Forms
   * that don't supply a schema still POST to the server validator —
   * this is just an early signal.
   */
  schema?: z.ZodType<TState>
}

interface UseSettingsFormResult<TState extends FieldValues> {
  /**
   * Live form values. Driven by RHF's `watch()`, so destructuring this
   * inside JSX always reflects the latest user input. Treat as readonly;
   * to mutate, use `setDraft` (whole-state reducer / replacement) or
   * RHF's `form.setValue` for field-granular updates.
   */
  draft: TState
  /**
   * Whole-state setter. Accepts either the new state directly or a
   * reducer function `(prev) => next`. Internally calls `form.reset`
   * with the new values while preserving RHF's dirty tracking so the
   * footer's "尚未保存" indicator stays accurate.
   */
  setDraft: (state: TState | ((prev: TState) => TState)) => void
  /** True when the form values differ from the most recent server snapshot. */
  isDirty: boolean
  /** Submit handler that calls `fromState(draft)` and posts to `updateSettings`. */
  onSubmit: SubmitEventHandler<HTMLFormElement>
  isPending: boolean
  status: 'idle' | 'saving' | 'saved' | 'error'
  errorMessage: string | null
  /**
   * Re-fetch the layout loader and discard local edits. Wired to the
   * "撤销更改" affordance in `SettingsFormBar`.
   */
  revert: () => void
  /**
   * Underlying RHF instance. Use `form.register('field')`,
   * `form.control`, and `form.formState.errors` for forms that want
   * field-level validation (e.g. `GeneralForm`). Forms that just need
   * draft / setDraft / onSubmit can ignore this.
   */
  form: UseFormReturn<TState>
}

// Shared lifecycle for every settings form. Wraps `react-hook-form` so
// every form (the simple ones plus the validated `GeneralForm`) reads
// from a single hook surface:
//
//   - `draft` mirrors RHF's `watch()` snapshot so consumers can keep the
//     "render the current state in JSX" pattern they had before.
//   - `setDraft` accepts a value or a reducer; it's a thin wrapper over
//     `form.reset` that re-applies the dirty flag so the footer's
//     "尚未保存的更改" indicator stays correct.
//   - When the parent loader returns a fresh `source`, we `reset` with
//     the new defaults so the form bar drops back to "已保存".
//   - Forms that supply a Zod `schema` get inline field-level errors via
//     `zodResolver`; the server stays the authoritative validator.
//
// Caller wiring:
//
//   const { draft, setDraft, isDirty, onSubmit, isPending, status,
//           errorMessage, revert } = useSettingsForm({
//     section: 'footer',
//     source: footer,
//     toState: (source) => ({ initialYear: source.initialYear, ... }),
//     fromState: (state) => ({ footer: { initialYear: state.initialYear, ... } }),
//   })
//
// then `<form onSubmit={onSubmit}>` and `<SettingsFormBar … onRevert={revert} />`.
export function useSettingsForm<TSource, TState extends FieldValues>({
  section,
  source,
  toState,
  fromState,
  schema,
}: UseSettingsFormOptions<TSource, TState>): UseSettingsFormResult<TState> {
  // Compute the projected default values once per `source` reference.
  // RHF's `useForm` only reads `defaultValues` at mount, so we feed the
  // initial projection here and reset on subsequent `source` changes
  // through the effect below.
  const initialValues = useMemo(
    () => toState(source) as DefaultValues<TState>,
    // `toState` is intentionally omitted from the dependency array.
    // Callers usually inline a fresh arrow function on every render
    // (which would otherwise re-evaluate this memo every time and reset
    // the form unexpectedly); the projection itself is stable per
    // `source` snapshot, so keying on `source` alone matches intent.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [source],
  )

  const resolver = useMemo<Resolver<TState> | undefined>(() => {
    if (!schema) {
      return undefined
    }
    // The `zodResolver` overloads are generic over `Input/Output`, but
    // we know the schema mirrors the form's `TState` shape (the
    // server-side schema is the authority — this is just the inline
    // hint for blur-time errors). Cast to the typed `Resolver<TState>`
    // so the field-error tree lines up with `formState.errors[k]`.
    return zodResolver(schema as never) as Resolver<TState>
  }, [schema])

  const form = useForm<TState>({
    defaultValues: initialValues,
    resolver,
    // `onBlur`: report validation errors once the user moves focus out
    // of a field instead of on every keystroke.
    mode: 'onBlur',
  })
  const { reset, handleSubmit, watch, getValues, formState } = form

  // Live snapshot of the form state. `watch()` (no argument) returns the
  // entire values object and re-renders on every input change, which is
  // the same observable surface the previous `useState<TState>` flavour
  // exposed.
  const draft = watch() as TState

  const setDraft = useCallback(
    (next: TState | ((prev: TState) => TState)) => {
      const value = typeof next === 'function' ? (next as (prev: TState) => TState)(getValues()) : next
      // `keepDefaultValues: true` keeps the server snapshot (set by the
      // initial `defaultValues` and re-applied on `source` change)
      // intact while `reset` re-derives `formState.isDirty` by deep-
      // comparing the new values against those defaults — exactly the
      // semantics the previous `useState<TState>` flavour exposed.
      reset(value as DefaultValues<TState>, { keepDefaultValues: true })
    },
    [getValues, reset],
  )

  // When the parent loader returns a new snapshot (after a save in
  // another tab, after `revert()`, or when the admin hot-navigates
  // between sections) re-seed the form with the new server values and
  // clear the dirty flag so the form bar drops back to the pristine
  // "已保存" state.
  useEffect(() => {
    reset(initialValues)
  }, [initialValues, reset])

  const onSaved = useCallback(() => {
    // After a successful save the parent loader revalidates and the
    // effect above re-seeds the form with the freshly-loaded values.
    // Until that round-trip completes we still want the form bar to
    // show "已保存" for the values the user actually submitted, so we
    // re-baseline RHF's defaults to whatever's currently in the form.
    reset(getValues(), { keepValues: true })
  }, [getValues, reset])
  const { save, revert: revertFetcher, isPending, status, errorMessage } = useSettingsFetcher({ section, onSaved })

  const validatedSubmit = handleSubmit((values) => {
    save(fromState(values))
  })
  const onSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    // RHF's `handleSubmit` returns a Promise; `<form onSubmit>` expects
    // a void-returning handler. The wrapper preserves the validation
    // short-circuit while keeping the type signature happy.
    void validatedSubmit(event)
  }

  const revert = useCallback(() => {
    reset(initialValues)
    revertFetcher()
  }, [initialValues, reset, revertFetcher])

  return {
    draft,
    setDraft,
    isDirty: formState.isDirty,
    onSubmit,
    isPending,
    status,
    errorMessage,
    revert,
    form,
  }
}
