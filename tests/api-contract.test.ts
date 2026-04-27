import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

import { API_ACTION_LIST, API_ACTIONS, type ApiActionMethod } from '@/client/api/actions'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const actionsDir = resolve(projectRoot, 'src/routes/api/actions')

// PII / capability-bearing field names that must never appear in URL query
// strings — they would leak into Nginx access logs, CDN caches, and browser
// history. Mutations must use a JSON body; reads carrying any of these must
// be promoted to POST.
const PII_QUERY_KEYS = ['userId', 'email', 'token', 'password'] as const

const READ_METHODS: readonly ApiActionMethod[] = ['GET']

describe('shared API action contract', () => {
  it('keeps route manifest paths and browser paths in lockstep', () => {
    for (const action of API_ACTION_LIST) {
      expect(action.path).toBe(`/${action.route}`)
      expect(action.route.startsWith('api/actions/')).toBe(true)
      expect(action.path.startsWith('/api/actions/')).toBe(true)
    }
  })

  it('declares every action route exactly once', () => {
    const routes = API_ACTION_LIST.map((action) => action.route)
    expect(new Set(routes).size).toBe(routes.length)
    expect(routes).toContain(API_ACTIONS.auth.updateUser.route)
    expect(routes).toContain(API_ACTIONS.comment.loadAll.route)
  })

  it('enumerates exactly one action per file under src/routes/api/actions/*.ts', () => {
    const files = readdirSync(actionsDir).filter((name) => name.endsWith('.ts'))
    // route key e.g. "api/actions/auth/signIn" → file basename "auth.signIn.ts"
    const routeFileNames = new Set(
      API_ACTION_LIST.map((action) => {
        const tail = action.route.replace(/^api\/actions\//, '')
        return `${tail.replace('/', '.')}.ts`
      }),
    )
    expect(new Set(files)).toEqual(routeFileNames)
  })

  it('uses only the four documented HTTP methods', () => {
    const allowed: ApiActionMethod[] = ['GET', 'POST', 'PATCH', 'DELETE']
    for (const action of API_ACTION_LIST) {
      expect(allowed).toContain(action.method)
    }
  })

  it('reserves GET methods for endpoints whose inputs carry no PII', () => {
    // Read every server-side action file; if it's a GET endpoint, it must
    // not pull `userId` / `email` / `token` / `password` out of the URL.
    for (const action of API_ACTION_LIST) {
      if (!READ_METHODS.includes(action.method)) {
        continue
      }
      const tail = action.route.replace(/^api\/actions\//, '')
      const filePath = resolve(actionsDir, `${tail.replace('/', '.')}.ts`)
      const source = readFileSync(filePath, 'utf8')
      for (const piiKey of PII_QUERY_KEYS) {
        expect(
          source.includes(piiKey),
          `${action.path} (${action.method}) must not reference PII key "${piiKey}". Promote it to POST + JSON body.`,
        ).toBe(false)
      }
    }
  })

  it('forbids writers (DELETE/PATCH/POST) from carrying state in URL search params', () => {
    // Mutations should authenticate through the body envelope so request
    // logs / CDN caches don't surface mutation parameters.
    for (const action of API_ACTION_LIST) {
      if (READ_METHODS.includes(action.method)) {
        continue
      }
      const tail = action.route.replace(/^api\/actions\//, '')
      const filePath = resolve(actionsDir, `${tail.replace('/', '.')}.ts`)
      const source = readFileSync(filePath, 'utf8')
      expect(
        source.includes('readSearchInput('),
        `${action.path} (${action.method}) must not call readSearchInput; mutations must use readJsonInput.`,
      ).toBe(false)
    }
  })

  it('ensures every action file declares the matching loader/action export for its method', () => {
    for (const action of API_ACTION_LIST) {
      const tail = action.route.replace(/^api\/actions\//, '')
      const filePath = resolve(actionsDir, `${tail.replace('/', '.')}.ts`)
      const source = readFileSync(filePath, 'utf8')
      const exportName = action.method === 'GET' ? 'loader' : 'action'
      // Resource routes can declare the export as either a function statement
      // (legacy `runApi` shape) or a const binding (declarative
      // `defineApiAction` shape). Both are valid React Router exports.
      const declaresExport =
        source.includes(`export function ${exportName}`) || source.includes(`export const ${exportName} `)
      expect(
        declaresExport,
        `${action.path} (${action.method}) is expected to declare \`export function ${exportName}\` or \`export const ${exportName}\`.`,
      ).toBe(true)
    }
  })
})
