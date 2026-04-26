import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

import { API_ACTION_LIST } from '@/client/api/actions'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const actionsDir = resolve(projectRoot, 'src/routes/api/actions')

// Static checks across every Resource Route file. We can't easily exercise
// the actions end-to-end (they pull Redis + Drizzle through `runApi`), but we
// can pin the conventions that make those endpoints predictable.

function readActionSource(route: string): { file: string; source: string } {
  const tail = route.replace(/^api\/actions\//, '')
  const file = resolve(actionsDir, `${tail.replace('/', '.')}.ts`)
  return { file, source: readFileSync(file, 'utf8') }
}

describe('routes/api/actions — file conventions', () => {
  it('every action file goes through the runApi perimeter', () => {
    for (const action of API_ACTION_LIST) {
      const { file, source } = readActionSource(action.route)
      // `defineApiAction` is the declarative wrapper around `runApi`; treat
      // either as a valid perimeter marker so future endpoints can pick the
      // shape that fits best.
      const usesPerimeter = source.includes('runApi(') || source.includes('defineApiAction(')
      expect(
        usesPerimeter,
        `${file} must funnel through runApi() or defineApiAction() for unified error handling.`,
      ).toBe(true)
    }
  })

  it('every mutating action validates input via readJsonInput (never trusts raw body)', () => {
    for (const action of API_ACTION_LIST) {
      if (action.method === 'GET') continue
      const { file, source } = readActionSource(action.route)
      // `defineApiAction` parses via the declared `input:` schema; only flag
      // raw `request.json()` use that bypasses both pathways.
      const usesReadJson = source.includes('readJsonInput(')
      const usesParseInput = source.includes('parseInput(')
      const usesDefineApiAction = source.includes('defineApiAction(')
      const usesRawJson = /request\.json\(\)/.test(source)
      if (usesRawJson) {
        expect(
          usesReadJson || usesParseInput || usesDefineApiAction,
          `${file} calls request.json() but should funnel input through readJsonInput / parseInput / defineApiAction.`,
        ).toBe(true)
      }
    }
  })

  it('admin-only actions explicitly gate on the admin session', () => {
    // The seven admin-only endpoints — explicitly enumerated to detect drift
    // (e.g. someone adding a new admin route without the gate).
    const adminEndpoints = new Set([
      'api/actions/comment/approve',
      'api/actions/comment/delete',
      'api/actions/comment/edit',
      'api/actions/comment/getRaw',
      'api/actions/comment/getFilterOptions',
      'api/actions/comment/loadAll',
      'api/actions/auth/updateUser',
    ])
    for (const action of API_ACTION_LIST) {
      if (!adminEndpoints.has(action.route)) continue
      const { file, source } = readActionSource(action.route)
      const usesGuard = source.includes('requireAdminSession(') || /requireAdmin:\s*true/.test(source)
      expect(
        usesGuard,
        `${file} is admin-only and must call requireAdminSession(session) or pass requireAdmin: true to defineApiAction.`,
      ).toBe(true)
    }
  })

  it('non-GET action files declare their expected HTTP method', () => {
    // GET endpoints are bound to a `loader` export that React Router only
    // dispatches on GET, so they're already 405-protected by the framework.
    // POST/PATCH/DELETE share the `action` export, so we require either an
    // explicit `assertMethod` call (legacy `runApi` shape) or a `method:`
    // declaration (declarative `defineApiAction` shape).
    for (const action of API_ACTION_LIST) {
      if (action.method === 'GET') continue
      const { file, source } = readActionSource(action.route)
      const declaresMethod =
        source.includes(`assertMethod(`) || new RegExp(`method:\\s*["'\`]${action.method}["'\`]`).test(source)
      expect(
        declaresMethod,
        `${file} must call assertMethod() or pass method: "${action.method}" so disallowed verbs return 405.`,
      ).toBe(true)
      const methodQuoted = new RegExp(`["'\`]${action.method}["'\`]`)
      expect(methodQuoted.test(source), `${file} must reference its HTTP method ("${action.method}").`).toBe(true)
    }
  })

  it('no leftover endpoints sit in src/routes/api/actions outside the manifest', () => {
    const files = readdirSync(actionsDir).filter((name) => name.endsWith('.ts'))
    const declared = new Set(
      API_ACTION_LIST.map(({ route }) => `${route.replace(/^api\/actions\//, '').replace('/', '.')}.ts`),
    )
    for (const file of files) {
      expect(declared.has(file), `${file} exists but isn't declared in API_ACTION_LIST.`).toBe(true)
    }
  })
})
