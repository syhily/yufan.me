import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'

function files(...args: string[]): string[] {
  // `rg --files` exits with a non-zero status when every input path is
  // missing (which happens after we deleted an entire feature tree), so we
  // return early if no path-like argument resolves on disk. Flag args (`-g`
  // plus its value) are kept intact.
  const paths = args.filter((arg) => !arg.startsWith('-'))
  if (paths.length === 0) {
    return []
  }
  if (paths.every((path) => !existsSync(path))) {
    return []
  }
  const out = execFileSync('rg', ['--files', ...args], { encoding: 'utf8' }).trim()
  return out === '' ? [] : out.split('\n')
}

describe('contract: module and bundle boundaries', () => {
  it('keeps catalog private modules behind @/server/catalog', () => {
    const offenders = files('src', 'tests', '-g', '*.ts', '-g', '*.tsx')
      .filter((file) => !file.startsWith('src/server/catalog/'))
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
        return /@\/server\/catalog\/(?:schema|catalog)(?:["'/])/.test(source)
      })

    expect(offenders).toEqual([])
  })

  it('keeps optional vendor CSS out of the root stylesheet', () => {
    const source = readFileSync('src/assets/styles/globals.css', 'utf8')

    expect(source).not.toContain('bootstrap/dist/css/bootstrap.css')
    expect(source).not.toContain('aplayer-ts/src/css/base.css')
    expect(source).not.toContain('medium-zoom/dist/style.css')
    expect(source).not.toContain('tippy.js')
  })

  it('keeps client utilities independent from UI component modules', () => {
    const offenders = files('src/client', 'src/shared', '-g', '*.ts').filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /@\/ui\//.test(source)
    })

    expect(offenders).toEqual([])
  })

  it('keeps UI components from importing server/runtime data modules', () => {
    const offenders = files('src/ui', '-g', '*.ts', '-g', '*.tsx').filter((file) => {
      const source = readFileSync(file, 'utf8')
      return source.split('\n').some((line) => {
        const trimmed = line.trim()
        if (!trimmed.startsWith('import') || trimmed.startsWith('import type')) {
          return false
        }
        return /@\/server\//.test(trimmed) || /\.server(?:["']|$)/.test(trimmed)
      })
    })

    expect(offenders).toEqual([])
  })

  it('keeps non-type catalog imports out of UI components', () => {
    const offenders = files('src/ui', '-g', '*.ts', '-g', '*.tsx').filter((file) => {
      const source = readFileSync(file, 'utf8')
      return source.split('\n').some((line) => {
        const trimmed = line.trim()
        return (
          trimmed.startsWith('import') && !trimmed.startsWith('import type') && trimmed.includes('"@/server/catalog"')
        )
      })
    })

    expect(offenders).toEqual([])
  })

  it('keeps Luxon out of client-facing chrome and date formatter paths', () => {
    const clientFacing = [
      ...files('src/ui', '-g', '*.ts', '-g', '*.tsx'),
      'src/shared/formatter.ts',
      'src/server/sidebar/select.ts',
      'src/routes/home.tsx',
    ]
    const offenders = clientFacing.filter((file) => readFileSync(file, 'utf8').includes('luxon'))

    expect(offenders).toEqual([])
  })

  it('keeps source relative imports inside the documented allowlist', () => {
    const allowed = (file: string, specifier: string): boolean => {
      if (specifier.startsWith('./+types/')) {
        return true
      }
      // `routes.ts` is loaded by React Router's `vite-node` configuration
      // pass *before* Vite's path aliases register, so the route manifest
      // and the API-actions re-export must use relative paths instead of
      // `@/shared/api-actions`. Both files document this constraint
      // inline.
      if (file === 'src/routes.ts' && specifier === './shared/api-actions') {
        return true
      }
      if (file === 'src/client/api/actions.ts' && specifier === '../../shared/api-actions') {
        return true
      }
      if (file === 'vite.config.ts' && specifier === './source.config.ts') {
        return true
      }
      if (file === 'source.config.ts' && specifier === './src/server/markdown/mermaid/index.ts') {
        return true
      }
      if (file === 'source.config.ts' && specifier === './src/server/markdown/rehype-code.ts') {
        return true
      }
      if (file === 'source.config.ts' && specifier === './src/server/markdown/rehype-image-enhance.ts') {
        return true
      }
      if (file === 'source.config.ts' && specifier === './src/server/markdown/rehype-mathjax.ts') {
        return true
      }
      if (
        file.startsWith('src/server/markdown/mermaid/') &&
        ['./errors.ts', './parse.ts', './render.ts', './types.ts'].includes(specifier)
      ) {
        return true
      }
      return false
    }

    const offenders: string[] = []
    const importRe = /from\s+["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g
    for (const file of files(
      'src',
      'source.config.ts',
      'vite.config.ts',
      'vitest.config.ts',
      'react-router.config.ts',
      '-g',
      '*.ts',
      '-g',
      '*.tsx',
    )) {
      const source = readFileSync(file, 'utf8')
      let match: RegExpExecArray | null
      while ((match = importRe.exec(source)) !== null) {
        const specifier = match[1] ?? match[2]
        if (!allowed(file, specifier)) {
          offenders.push(`${file}: ${specifier}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('keeps DOM/script islands out of the tree (React only)', () => {
    // Public interactivity now lives in React hooks/components. Guard the
    // regression by asserting the legacy vanilla script tree stays empty.
    const legacy = files('src/assets/scripts', '-g', '*.ts')
    expect(legacy).toEqual([])
  })

  it('documents React islands instead of the removed src/assets/scripts tree', () => {
    const agents = readFileSync('AGENTS.md', 'utf8')
    expect(agents).toContain('`src/assets/scripts` is intentionally absent')
    expect(agents).not.toContain('src/assets/scripts/**/*.ts')
    expect(agents).not.toContain('Do not remove existing browser scripts')
  })

  it('keeps domain Zod schemas out of db/types', () => {
    const source = readFileSync('src/server/db/types/index.ts', 'utf8')
    expect(source).not.toContain('db/types/auth')
    expect(source).not.toContain('db/types/comment')
  })

  it('loads OPPO font CSS from public instead of the root CSS bundle', () => {
    const globals = readFileSync('src/assets/styles/globals.css', 'utf8')
    const root = readFileSync('src/root.tsx', 'utf8')

    expect(globals).not.toContain('opposans.css')
    expect(globals).not.toContain('opposerif.css')
    expect(root).toContain("href: '/fonts/opposans.css'")
    expect(root).toContain("href: '/fonts/opposerif.css'")
    expect(files('public/fonts', '-g', '*.css').sort()).toEqual([
      'public/fonts/opposans.css',
      'public/fonts/opposerif.css',
    ])
  })

  it('keeps solution math scrollable instead of clipping long formulas', () => {
    const css = readFileSync('src/assets/styles/globals.css', 'utf8')
    const rehype = readFileSync('src/server/markdown/rehype-mathjax.ts', 'utf8')
    const solution = readFileSync('src/ui/mdx/solutions/Solution.tsx', 'utf8')

    // The `.solution` blockquote must never set `overflow: hidden`; long
    // MathJax formulas would be clipped before they could scroll. The
    // wrapper itself opts into a horizontal scroll surface via Tailwind
    // utilities on the JSX root.
    expect(css).not.toMatch(/\.prose-host \.solution\s*{[^}]*overflow:\s*hidden/s)
    expect(solution).toMatch(/overflow-x-auto/)
    expect(solution).toMatch(/overflow-y-hidden/)

    // `.solution`-internal `<p>` / `<mjx-container>` margins are now
    // collapsed via Tailwind arbitrary descendant variants on the
    // `<Solution>` wrapper, not via a `.prose-host .solution p` cascade.
    expect(solution).toMatch(/\[&_p\]:/)
    expect(solution).toMatch(/\[&_mjx-container\]:/)

    // Display-mode MathJax containers must remain horizontally scrollable.
    // The overflow is applied by `rehype-mathjax.ts` as a Tailwind utility
    // baked into the generated `<mjx-container>` className list, so the
    // legacy `.prose-host mjx-container[...]` cascade no longer exists.
    expect(rehype).toContain('overflow-x-auto')
    expect(rehype).toContain("'mjx-container'")
  })

  // ---------------------------------------------------------------------
  // Design-system lock-down (refactor-design.md "Phase B" contract tests).
  //
  // The cleanups completed in commits A1–B1 collapsed the Bootstrap-era
  // `min-[…px]:` / `max-[…px]:` literals onto the named breakpoint
  // variants (`sm:` / `md:` / `lg:` / `xl:` / `2xl:`), moved every
  // brand-hex constant into a CSS variable, renamed the legacy article
  // wrapper class to `.prose-host`, capped the `@layer components`
  // scopes at three, and routed comments + category descriptions
  // through the runtime MDX pipeline. The five tests below freeze that
  // contract so the next refactor doesn't reintroduce them silently.
  // ---------------------------------------------------------------------

  it('keeps Bootstrap-era min-[Npx]: / max-[Npx]: literals out of src/ui', () => {
    // Tailwind variants `sm:` / `md:` / `lg:` / `xl:` / `2xl:` (declared
    // via `@theme` in `globals.css`) are the only sanctioned breakpoint
    // hooks. Anything else has to spell out a justification in a comment;
    // the regex below ignores comment lines so legitimate prose still
    // compiles, but trips on real class strings.
    const literalRe = /(?:min|max)-\[\d+(?:\.\d+)?(?:px|rem)\]:/
    const offenders = files('src/ui', '-g', '*.ts', '-g', '*.tsx').filter((file) => {
      const source = readFileSync(file, 'utf8')
      return source.split('\n').some((line) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('//')) {
          return false
        }
        if (trimmed.startsWith('*')) {
          return false
        }
        return literalRe.test(line)
      })
    })

    expect(offenders).toEqual([])
  })

  it('keeps brand-hex literals out of UI component modules (tokens only)', () => {
    // The full hex palette lives in the `@theme` block in
    // `globals.css`; component-tree CSS files (e.g.
    // `tocTokens.css`, `codeBlockTokens.css`) hold component-scoped
    // tokens. Inside `.tsx` / `.ts` we only ever consume the named
    // tokens (`text-foreground`, `bg-accent`, etc.), so a literal
    // `#…` in a JSX file is always a regression. Comments are skipped
    // so legitimate prose can still mention historical values.
    const hexRe = /#[0-9a-fA-F]{3,8}\b/
    const offenders = files('src/ui', '-g', '*.ts', '-g', '*.tsx').filter((file) => {
      const source = readFileSync(file, 'utf8')
      return source.split('\n').some((line) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('//')) {
          return false
        }
        if (trimmed.startsWith('*')) {
          return false
        }
        return hexRe.test(line)
      })
    })

    expect(offenders).toEqual([])
  })

  it('does not reintroduce the legacy prose wrapper class name', () => {
    // The article wrapper, comment bodies, and category-description
    // previews all share `<div className="prose-host …">` now. The
    // legacy class was renamed in the design-system refactor; this test
    // prevents it from creeping back via a search / replace gone wrong.
    // The offending name is constructed at runtime so the test file
    // itself doesn't trip the regex.
    const legacy = ['post', 'content'].join('-')
    const classRe = new RegExp(`["'\\s]${legacy}(?=["'\\s])`)
    const cssRe = new RegExp(`\\.${legacy}\\b`)
    const sources = [
      ...files('src', '-g', '*.ts', '-g', '*.tsx', '-g', '*.css'),
      ...files('tests', '-g', '*.ts', '-g', '*.tsx'),
    ].filter((file) => existsSync(file))
    const offenders = sources.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return classRe.test(source) || cssRe.test(source)
    })

    expect(offenders).toEqual([])
  })

  it('keeps @layer components capped at three selector scope strings', () => {
    // The `@layer components` block is reserved for HTML we do NOT
    // control — Fumadocs MDX cascade (`.prose-host`), Shiki tokens
    // (`pre.shiki`), and medium-zoom portal nodes
    // (`.medium-zoom-overlay`). Anything else has to live inline on a
    // React component or as a token in `@theme`, so we cap the layer at
    // three distinct top-level selectors. `@variant` blocks reuse the
    // same scopes, so they don't count toward the cap.
    const rawCss = readFileSync('src/assets/styles/globals.css', 'utf8')
    // Strip CSS block comments first — comments often embed brace
    // characters (e.g. `src/ui/mdx/{prose,table}.tsx`) that would
    // otherwise confuse the depth tracker below.
    const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '')

    // Find the top-level `@layer components { ... }` block. We balance
    // braces manually because the block contains nested `@variant`
    // groups that a non-greedy `.+?` would prematurely terminate on.
    const layerStart = css.indexOf('@layer components')
    expect(layerStart).toBeGreaterThan(-1)
    const openBrace = css.indexOf('{', layerStart)
    expect(openBrace).toBeGreaterThan(-1)
    let depth = 0
    let layerEnd = -1
    for (let i = openBrace; i < css.length; i++) {
      const ch = css[i]
      if (ch === '{') {
        depth += 1
      } else if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          layerEnd = i
          break
        }
      }
    }
    expect(layerEnd).toBeGreaterThan(openBrace)
    const body = css.slice(openBrace + 1, layerEnd)

    // Strip `@variant …` wrappers — they reuse outer scopes and would
    // otherwise double-count toward the cap.
    const stripped = body.replace(/@variant\s+\w+\s*{/g, '')

    // Match every "selector list before `{`" by scanning forward; we
    // gather the comma-group head of each rule and take the leading
    // simple selector (`pre.shiki span` -> `pre.shiki`).
    const scopes = new Set<string>()
    const ruleRe = /([^{}@]+?)\{/g
    let match: RegExpExecArray | null
    while ((match = ruleRe.exec(stripped)) !== null) {
      const selectorList = match[1].trim()
      if (selectorList === '') {
        continue
      }
      // A leftover `}` from a closed `@variant` wrapper shouldn't count.
      const head = selectorList
        .replace(/^[}\s]+/, '')
        .split(',')[0]
        ?.trim()
        .split(/\s+/)[0]
      if (head !== undefined && head !== '' && !head.startsWith('@')) {
        scopes.add(head)
      }
    }

    expect([...scopes].sort()).toEqual(['.medium-zoom-overlay', '.prose-host', 'pre.shiki'])
  })

  it('renders comments and category descriptions through MDX, not raw HTML injection', () => {
    // `.comment-content` was retired in commit A4 — comments now
    // compile through `@/server/markdown/runtime` and render via
    // `<CommentBody />`. Category descriptions follow the same path
    // through `<CategoriesBody />`. A raw `dangerouslySetInnerHTML`
    // anywhere in those trees indicates a regression that bypasses the
    // shared `postMdxComponents` map and the XSS-safe MDX sandbox.
    const offenders = [
      ...files('src/ui/comments', '-g', '*.ts', '-g', '*.tsx'),
      ...files('src/ui/post/categories', '-g', '*.ts', '-g', '*.tsx'),
    ].filter((file) => /dangerouslySetInnerHTML/.test(readFileSync(file, 'utf8')))

    expect(offenders).toEqual([])
  })
})
