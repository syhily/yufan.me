import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

// Static import-boundary linter for the four-layer architecture
// described in `AGENTS.md` ("RSC Layering Rules"). The test walks every
// `.ts` / `.tsx` file under `src/` and asserts that the import graph
// between layers is one-way:
//
// - `shared/*` only imports `shared/*` (the strictest layer — both
//   bundles must evaluate it).
// - `client/*` and `ui/*` may import `shared/*`, `ui/*`, `client/*`,
//   but never `server/*` and never anything ending in `.server.ts(x)`.
// - `server/*` may import `shared/*` and other `server/*`, but never
//   `client/*`, `ui/*`, or `routes/*`.
//
// We deliberately keep this self-contained (no `madge` dependency) so the
// boundary check rides the same `vp test` channel as everything else and
// the assertion failures cite the exact import that crossed the line.
//
// Type-only imports (`import type … from`) are skipped because TypeScript
// erases them at build time and they never reach the runtime bundle.

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const srcRoot = resolve(projectRoot, 'src')

interface Source {
  abs: string
  /** Path relative to `src/`, slash-normalised. */
  rel: string
  contents: string
}

function isExcluded(name: string): boolean {
  // `+types/*` is React Router-generated route type codegen — outside
  // the source-of-truth import graph.
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
        abs,
        rel: relative(srcRoot, abs).split('\\').join('/'),
        contents: readFileSync(abs, 'utf8'),
      })
    }
  }
  walk(srcRoot)
  return out
}

interface ImportEdge {
  /** Where the import lives (relative to src/). */
  from: string
  /** Raw specifier from the source. */
  specifier: string
  /** Whether it's `import type ...` (erased at runtime). */
  typeOnly: boolean
}

const IMPORT_RE = /(?:^|\n)\s*import\s+(type\s+)?(?:[\s\S]*?)from\s+["']([^"']+)["']/g
const SIDE_EFFECT_IMPORT_RE = /(?:^|\n)\s*import\s+["']([^"']+)["']/g
// Per-specifier `type` markers in named import lists (e.g.
// `import { Foo, type Bar } from '...'`) and `import('...')` /
// `await import('...')` calls — both remain runtime references.
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g

function listImports(source: Source): ImportEdge[] {
  const edges: ImportEdge[] = []
  for (const match of source.contents.matchAll(IMPORT_RE)) {
    const [, typeMarker, specifier] = match
    if (specifier === undefined) {
      continue
    }
    edges.push({ from: source.rel, specifier, typeOnly: typeMarker !== undefined })
  }
  for (const match of source.contents.matchAll(SIDE_EFFECT_IMPORT_RE)) {
    const [, specifier] = match
    if (specifier === undefined) {
      continue
    }
    // Side-effect imports always reach the runtime bundle.
    edges.push({ from: source.rel, specifier, typeOnly: false })
  }
  for (const match of source.contents.matchAll(DYNAMIC_IMPORT_RE)) {
    const [, specifier] = match
    if (specifier === undefined) {
      continue
    }
    edges.push({ from: source.rel, specifier, typeOnly: false })
  }
  return edges
}

type Layer = 'server' | 'ui' | 'client' | 'shared' | 'routes' | 'content' | 'assets' | 'other'

function topLevelDir(rel: string): Layer {
  const head = rel.split('/')[0]
  switch (head) {
    case 'server':
    case 'ui':
    case 'client':
    case 'shared':
    case 'routes':
    case 'content':
    case 'assets':
      return head
    default:
      return 'other'
  }
}

interface ResolvedSpec {
  alias: Layer | 'external'
  /** True for `.server.ts(x)` markers regardless of layer. */
  isServerOnlyMarker: boolean
}

function classifySpecifier(specifier: string, sourceRel: string): ResolvedSpec {
  // Path-alias specifiers (`@/...`) map directly to `src/...`.
  if (specifier.startsWith('@/')) {
    const inside = specifier.slice(2)
    const alias = topLevelDir(inside)
    const isServerOnlyMarker = /\.server($|\/)/.test(inside) || /\.server\.ts(x)?$/.test(inside)
    return { alias, isServerOnlyMarker }
  }

  // Public-asset alias (`~/...`) → `public/`. External, ignored.
  if (specifier.startsWith('~/')) {
    return { alias: 'external', isServerOnlyMarker: false }
  }

  // Fumadocs source alias.
  if (specifier.startsWith('#source/')) {
    return { alias: 'external', isServerOnlyMarker: false }
  }

  // Relative imports — resolve into the same top-level layer as the
  // importer. This is approximate but correct enough for the boundary
  // we care about (`server/foo` importing `../client/bar` would still
  // be a relative path that bubbles up two levels).
  if (specifier.startsWith('.')) {
    const sourceLayer = topLevelDir(sourceRel)
    const isServerOnlyMarker = /\.server($|\/)/.test(specifier) || specifier.endsWith('.server')
    return { alias: sourceLayer, isServerOnlyMarker }
  }

  return { alias: 'external', isServerOnlyMarker: false }
}

const sources = walkSources()

describe('import boundaries — RSC layering rules', () => {
  it('every source file is reachable (sanity)', () => {
    expect(sources.length).toBeGreaterThan(50)
  })

  it('shared/* only imports shared/* (no server/client/ui/routes)', () => {
    const violations: string[] = []
    for (const source of sources) {
      if (topLevelDir(source.rel) !== 'shared') {
        continue
      }
      for (const edge of listImports(source)) {
        if (edge.typeOnly) {
          continue
        }
        const target = classifySpecifier(edge.specifier, source.rel)
        if (
          target.alias === 'server' ||
          target.alias === 'client' ||
          target.alias === 'ui' ||
          target.alias === 'routes'
        ) {
          violations.push(`${source.rel} imports ${edge.specifier} from ${target.alias}/*`)
        }
        if (target.isServerOnlyMarker) {
          violations.push(`${source.rel} imports server-only ${edge.specifier}`)
        }
      }
    }
    expect(violations, formatViolations('shared/*', violations)).toEqual([])
  })

  it('client/* must not import server/* or any *.server.* module', () => {
    const violations: string[] = []
    for (const source of sources) {
      if (topLevelDir(source.rel) !== 'client') {
        continue
      }
      for (const edge of listImports(source)) {
        if (edge.typeOnly) {
          continue
        }
        const target = classifySpecifier(edge.specifier, source.rel)
        if (target.alias === 'server') {
          violations.push(`${source.rel} imports ${edge.specifier} from server/*`)
        }
        if (target.isServerOnlyMarker) {
          violations.push(`${source.rel} imports server-only ${edge.specifier}`)
        }
      }
    }
    expect(violations, formatViolations('client/*', violations)).toEqual([])
  })

  it('ui/* must not import server/* or any *.server.* module', () => {
    const violations: string[] = []
    for (const source of sources) {
      if (topLevelDir(source.rel) !== 'ui') {
        continue
      }
      for (const edge of listImports(source)) {
        if (edge.typeOnly) {
          continue
        }
        const target = classifySpecifier(edge.specifier, source.rel)
        if (target.alias === 'server') {
          violations.push(`${source.rel} imports ${edge.specifier} from server/*`)
        }
        if (target.isServerOnlyMarker) {
          violations.push(`${source.rel} imports server-only ${edge.specifier}`)
        }
      }
    }
    expect(violations, formatViolations('ui/*', violations)).toEqual([])
  })

  it('server/* may import shared/* and other server/* but never client/* or ui/*', () => {
    const violations: string[] = []
    for (const source of sources) {
      if (topLevelDir(source.rel) !== 'server') {
        continue
      }
      for (const edge of listImports(source)) {
        if (edge.typeOnly) {
          continue
        }
        const target = classifySpecifier(edge.specifier, source.rel)
        if (target.alias === 'client' || target.alias === 'ui' || target.alias === 'routes') {
          if (isAllowedServerEdge(source.rel, edge.specifier)) {
            continue
          }
          violations.push(`${source.rel} imports ${edge.specifier} from ${target.alias}/*`)
        }
      }
    }
    expect(violations, formatViolations('server/*', violations)).toEqual([])
  })

  // `@/blog.config` is the static site-config module. UI components must
  // read it through `useSiteConfig()` (provided by `<BaseLayout>`) so the
  // upcoming database-backed config swap only touches `root.tsx`. Type-only
  // imports remain allowed because TypeScript erases them at compile time.
  it('ui/* must not import the runtime @/blog.config module', () => {
    const violations: string[] = []
    for (const source of sources) {
      if (topLevelDir(source.rel) !== 'ui') {
        continue
      }
      for (const edge of listImports(source)) {
        if (edge.typeOnly) {
          continue
        }
        if (edge.specifier !== '@/blog.config') {
          continue
        }
        violations.push(`${source.rel} imports the runtime @/blog.config module — use useSiteConfig() instead`)
      }
    }
    expect(violations, formatViolations('ui/*', violations)).toEqual([])
  })
})

/**
 * Documented exceptions to the server → ui rule. The feed pipeline
 * intentionally consumes a small set of MDX-renderable React components
 * via `prerenderToHtml(<Body components={…} />)` because RSS/Atom output
 * cannot carry a live React tree. Those components are pure-props (no
 * DOM reads, no browser-only APIs) so importing them on the server is
 * safe; we just have to opt-in here so the rule still catches accidental
 * server → ui crossings everywhere else.
 */
function isAllowedServerEdge(sourceRel: string, specifier: string): boolean {
  if (sourceRel !== 'server/feed/index.tsx') {
    return false
  }
  return (
    specifier === '@/ui/mdx/music/MusicPlayer' ||
    specifier === '@/ui/mdx/page/Friends' ||
    specifier === '@/ui/mdx/solutions/Solution'
  )
}

function formatViolations(layer: string, violations: string[]): string {
  if (violations.length === 0) {
    return ''
  }
  return [
    `${layer} layer must respect the RSC boundary rules in AGENTS.md.`,
    `Found ${violations.length} violation${violations.length === 1 ? '' : 's'}:`,
    ...violations.map((v) => `  - ${v}`),
  ].join('\n')
}
