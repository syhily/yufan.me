import { useCallback } from 'react'
import { toast } from 'sonner'

import type { ApiActionDescriptor, UseApiFetcherResult } from '@/client/api/fetcher'

import { useApiFetcher } from '@/client/api/fetcher'

export interface UseAdminMutationOptions<O> {
  /** Toast message on success. Pass a function to derive from the returned data. Omit / pass false to suppress. */
  successMessage?: string | ((data: O) => string) | false
  /** Custom prefix for default error toast (default: "操作失败"). */
  errorMessage?: string | ((error: { message: string }) => string)
  /** Called once per successful response (after toast). */
  onSuccess?: (data: O) => void
  /** Called once per error envelope (after toast). Return `true` to suppress the default error toast. */
  onError?: (error: { message: string }) => boolean | void
}

export function useAdminMutation<I, O>(
  action: ApiActionDescriptor,
  options?: UseAdminMutationOptions<O>,
): UseApiFetcherResult<I, O> {
  const fetcher = useApiFetcher<I, O>(action, {
    onSuccess: useCallback(
      (data: O) => {
        const msg = options?.successMessage
        if (msg !== false && msg !== undefined) {
          toast.success(typeof msg === 'function' ? msg(data) : msg)
        }
        options?.onSuccess?.(data)
      },
      [options],
    ),
    onError: useCallback(
      (error: { message: string }) => {
        const suppress = options?.onError?.(error) === true
        if (suppress) {
          return
        }
        const msg = options?.errorMessage
        if (typeof msg === 'function') {
          toast.error(msg(error))
        } else if (typeof msg === 'string') {
          toast.error(msg, { description: error.message })
        } else {
          toast.error('操作失败', { description: error.message })
        }
      },
      [options],
    ),
  })

  return fetcher
}

export { toast }
