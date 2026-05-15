import { z } from 'zod'

export const errorResponse = z.object({
  error: z.object({
    message: z.string(),
    issues: z.array(z.object({ message: z.string(), path: z.array(z.string()).optional() })).optional(),
  }),
})

export const standardMutationErrors = {
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  413: errorResponse,
  429: errorResponse,
  500: errorResponse,
} as const

export const standardReadErrors = {
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  500: errorResponse,
} as const
