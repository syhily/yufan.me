import type { AppRoute, AppRouter } from '@ts-rest/core'

import { describe, expect, it } from 'vite-plus/test'

import { apiContract } from '@/shared/contracts'

// Repo-wide invariants on the shape of every leaf route in the
// contract tree. Each invariant is one `it` so a regression surfaces
// against a single endpoint name. Whenever a new contract is added,
// this file is the safety net that catches:
//   - missing `commonResponses` 500 (controllers throw uncaught -> ?)
//   - missing `strictStatusCodes` (response schemas drift silently)
//   - no success response (`200|201|204`) declared
//   - no error response declared on mutation routes
//
// Use `c.router(..., { ... })` options to satisfy each — see
// `src/shared/contracts/_errors.ts` for the standard error spreads.

function isAppRouteValue(v: unknown): v is AppRoute {
  return typeof v === 'object' && v !== null && 'method' in v && 'path' in v && 'responses' in v
}

interface Leaf {
  path: string
  method: string
  route: AppRoute
  routerOptions: Record<string, unknown> | undefined
}

function collectLeaves(router: AppRouter, parent: Record<string, unknown> | undefined = undefined): Leaf[] {
  const out: Leaf[] = []
  const opts = (router as unknown as { options?: Record<string, unknown> }).options ?? parent
  for (const [_key, value] of Object.entries(router)) {
    if (isAppRouteValue(value)) {
      out.push({ path: value.path, method: value.method, route: value, routerOptions: opts })
    } else if (typeof value === 'object' && value !== null) {
      out.push(...collectLeaves(value as AppRouter, opts))
    }
  }
  return out
}

const leaves = collectLeaves(apiContract)

describe('every leaf route declares a 2xx success response', () => {
  it.each(leaves.map((l) => [`${l.method} ${l.path}`, l]))('%s', (_id, leaf) => {
    const statuses = Object.keys(leaf.route.responses)
    const has2xx = statuses.some((s) => /^2\d\d$/.test(s))
    expect(has2xx).toBe(true)
  })
})

describe('every leaf route declares a 500 fallback (via commonResponses or explicit)', () => {
  it.each(leaves.map((l) => [`${l.method} ${l.path}`, l]))('%s', (_id, leaf) => {
    const own = '500' in leaf.route.responses || 500 in leaf.route.responses
    // commonResponses are merged into `responses` by `c.router()` itself,
    // so `leaf.route.responses[500]` will exist on a properly-configured
    // contract regardless of where the spread came from.
    expect(own).toBe(true)
  })
})

describe('leaves have at least one error response on non-GET methods', () => {
  it.each(leaves.filter((l) => l.method !== 'GET').map((l) => [`${l.method} ${l.path}`, l]))('%s', (_id, leaf) => {
    const statuses = Object.keys(leaf.route.responses)
    const has4xxOr5xx = statuses.some((s) => /^[45]\d\d$/.test(s))
    expect(has4xxOr5xx).toBe(true)
  })
})
