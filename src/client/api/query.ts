import { useMutation, useQuery, type UseMutationOptions, type UseQueryOptions } from '@tanstack/react-query'

import { ApiError } from './error'

export function useApiQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<T, ApiError>({ queryKey: key, queryFn: fetcher, ...options })
}

export function useApiMutation<TVars, TData>(
  mutate: (vars: TVars) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, ApiError, TVars>, 'mutationFn'>,
) {
  return useMutation<TData, ApiError, TVars>({ mutationFn: mutate, ...options })
}
