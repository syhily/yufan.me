import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'

function files(...args: string[]): string[] {
  // `rg --files` exits with a non-zero status when every input path is
  // missing (which happens after we deleted an entire feature tree), so we
  // return early if no path-like argument resolves on disk. Flag args (`-g`
  // plus its value) are kept intact.
  const paths = args.filter((arg) => !arg.startsWith('-'))
  if (paths.length === 0) return []
  if (paths.every((path) => !existsSync(path))) return []
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
        if (!trimmed.startsWith('import') || trimmed.startsWith('import type')) return false
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
      if (specifier.startsWith('./+types/')) return true
      if (file === 'src/routes.ts' && specifier === './client/api/actions') return true
      if (file === 'vite.config.ts' && specifier === './source.config.ts') return true
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
    expect(root).toContain('href: "/fonts/opposans.css"')
    expect(root).toContain('href: "/fonts/opposerif.css"')
    expect(files('public/fonts', '-g', '*.css').sort()).toEqual([
      'public/fonts/opposans.css',
      'public/fonts/opposerif.css',
    ])
  })

  it('keeps solution math scrollable instead of clipping long formulas', () => {
    const source = readFileSync('src/assets/styles/_base.css', 'utf8')

    expect(source).not.toMatch(/\.post-content \.solution\s*{[^}]*overflow:\s*hidden/s)
    expect(source).toContain('.post-content mjx-container[jax="SVG"][display="true"]')
    expect(source).toContain('overflow-x: auto')
  })
})
