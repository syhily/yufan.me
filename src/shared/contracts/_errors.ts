// Unified error response schema + status-code response groups every
// contract spreads into its `responses` map. See migration plan
// Part 3.3.

import { z } from 'zod'

export const errorResponse = z.object({
  error: z.object({
    message: z.string(),
    issues: z
      .array(
        z.object({
          message: z.string(),
          path: z.array(z.string()).optional(),
        }),
      )
      .optional(),
  }),
})

export type ErrorResponse = z.infer<typeof errorResponse>

// ⚠️ Phase A1 spike finding: ts-rest 3.53.0-rc.1 + Zod 4 erases
// numeric literal keys when an `as const`-typed error map is spread
// into `responses: { 200: ..., ...errors }`. The resulting
// `keyof T['responses']` collapses to just `200` (or whatever the
// inline-declared key is), so the controller's `HandlerReturn`
// drops every error branch and `strictStatusCodes` becomes
// unusable. Until upstream ts-rest restores spread inference, the
// convention is: **inline every status code in the contract.**
//
// The two functions below build the responses literal for you so
// the call site stays compact. `mutationErrorResponses(extra)` is
// for POST/PATCH/PUT/DELETE; `readErrorResponses(extra)` is for
// GET. They return the literal object that callers should splat
// across in their `responses` map (or just hand-spell when only a
// subset applies).
//
// Track upstream: https://github.com/ts-rest/ts-rest (the 3.53 RC
// switched the schema slot to StandardSchemaV1; the regression
// most likely lives in that conversion path).
export const standardMutationErrorResponses = () =>
  ({
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: errorResponse,
    413: errorResponse,
    429: errorResponse,
    500: errorResponse,
  }) as const

export const standardReadErrorResponses = () =>
  ({
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    500: errorResponse,
  }) as const
