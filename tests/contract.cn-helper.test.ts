import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

// Static linter for the project's class-name composer contract.
//
// `AGENTS.md` (Editing Guidance) names `cn` from `@/ui/lib/cn` as the
// canonical helper that combines `clsx` and `tailwind-merge`. The
// matching shadcn skill records `aliases.lib = "@/ui/lib"` in
// `components.json` and treats `cn()` as the project's class-arbitration
// boundary — direct imports of `clsx` / `tailwind-merge` outside of
// `cn.ts` itself bypass `twMerge` (and break design-system token
// arbitration when conflicting Tailwind utilities meet).
//
// This test walks every `.ts` / `.tsx` file under `src/` and asserts:
//
// - No file other than `src/ui/lib/cn.ts` imports from `tailwind-merge`.
// - No file other than `src/ui/lib/cn.ts` imports from `clsx`.
//
// Type-only imports (`import type { ClassValue } from 'clsx'`) remain
// allowed because TypeScript erases them at build time and they never
// reach the runtime bundle. The `cn` helper itself imports `ClassValue`
// as a type-only specifier; legitimate consumers can do the same.

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const srcRoot = resolve(projectRoot, 'src')

interface Source {
  rel: string
  contents: string
}

function isExcluded(name: string): boolean {
  return name === '+types' || name === 'node_modules' || name === '.source'
}

function walkSources(): Source[] {
  const out: Source[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const abs = resolve(dir, entry)
      if (isExcluded(entry)) {
        continue
      }
      const stats = statSync(abs)
      if (stats.isDirectory()) {
        walk(abs)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry) || entry.endsWith('.d.ts')) {
        continue
      }
      out.push({
        rel: relative(srcRoot, abs).split('\\').join('/'),
        contents: readFileSync(abs, 'utf8'),
      })
    }
  }
  walk(srcRoot)
  return out
}

interface ImportEdge {
  from: string
  specifier: string
  /** Whether the entire import declaration is `import type ... from '...'`. */
  typeOnly: boolean
}

const IMPORT_RE = /(?:^|\n)\s*import\s+(type\s+)?(?:[\s\S]*?)from\s+["']([^"']+)["']/g

function listImports(source: Source): ImportEdge[] {
  const edges: ImportEdge[] = []
  for (const match of source.contents.matchAll(IMPORT_RE)) {
    const [, typeMarker, specifier] = match
    if (specifier === undefined) {
      continue
    }
    edges.push({ from: source.rel, specifier, typeOnly: typeMarker !== undefined })
  }
  return edges
}

const sources = walkSources()
const HELPER_REL = 'ui/lib/cn.ts'
const FORBIDDEN_PACKAGES = ['tailwind-merge', 'clsx'] as const

describe('contract: cn() helper hygiene', () => {
  it('every source file is reachable (sanity)', () => {
    expect(sources.length).toBeGreaterThan(50)
  })

  for (const pkg of FORBIDDEN_PACKAGES) {
    it(`only @/${HELPER_REL} imports from "${pkg}" at runtime`, () => {
      const violations: string[] = []
      for (const source of sources) {
        if (source.rel === HELPER_REL) {
          continue
        }
        for (const edge of listImports(source)) {
          if (edge.typeOnly) {
            continue
          }
          if (edge.specifier !== pkg) {
            continue
          }
          violations.push(
            `${source.rel} imports "${pkg}" directly — use \`cn\` from \`@/ui/lib/cn\` so Tailwind class arbitration stays centralised`,
          )
        }
      }
      expect(violations, formatViolations(pkg, violations)).toEqual([])
    })
  }
})

function formatViolations(pkg: string, violations: string[]): string {
  if (violations.length === 0) {
    return ''
  }
  return [
    `Direct runtime imports of "${pkg}" are forbidden outside of @/ui/lib/cn.`,
    `Found ${violations.length} violation${violations.length === 1 ? '' : 's'}:`,
    ...violations.map((v) => `  - ${v}`),
  ].join('\n')
}
