import { describe, expect, it } from 'vite-plus/test'

import { compileMarkdown } from '@/server/markdown/runtime'

// Safety net for the runtime MDX compiler (`@fumadocs/mdx-remote`-backed)
// that powers in-app comments and category descriptions. Compilation is
// expensive on cold-load (mathjax + shiki + rehype chain) but warmed
// downstream calls hit the LRU and return immediately.
describe('services/markdown/runtime', () => {
  it('returns null for null/undefined input', async () => {
    expect(await compileMarkdown(null, { profile: 'comment' })).toBeNull()
    expect(await compileMarkdown(undefined, { profile: 'comment' })).toBeNull()
  })

  it('returns null for an empty source (whitespace-only is empty)', async () => {
    expect(await compileMarkdown('', { profile: 'comment' })).toBeNull()
    expect(await compileMarkdown('   \n  \n', { profile: 'comment' })).toBeNull()
  })

  it('compiles a simple paragraph for the comment profile', { timeout: 30_000 }, async () => {
    const compiled = await compileMarkdown('Hello, world.', { profile: 'comment' })
    expect(compiled).not.toBeNull()
    expect(typeof compiled?.compiled).toBe('string')
    expect(compiled?.compiled.length ?? 0).toBeGreaterThan(0)
    expect(compiled?.plain).toBe('Hello, world.')
  })

  it('compiles a paragraph with an inline link', async () => {
    const compiled = await compileMarkdown('See [example](https://example.com).', { profile: 'comment' })
    expect(compiled?.compiled).toContain('https://example.com')
  })

  it('returns the same Promise on cache hit (LRU re-use)', async () => {
    const first = compileMarkdown('# cached heading', { profile: 'category' })
    const second = compileMarkdown('# cached heading', { profile: 'category' })
    expect(second).toStrictEqual(first)
    expect(await first).toBe(await second)
  })

  it('isolates cache entries between profiles', async () => {
    // Same source, different profile → different cached result objects (the
    // category profile additionally enables `rehypeTitleFigure`).
    const a = await compileMarkdown('![logo](https://yufan.me/logo.png)\n', { profile: 'comment' })
    const b = await compileMarkdown('![logo](https://yufan.me/logo.png)\n', { profile: 'category' })
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a).not.toBe(b)
  })

  it('isolates the email profile from comment MDX output', async () => {
    const comment = await compileMarkdown('# Title', { profile: 'comment' })
    const email = await compileMarkdown('# Title', { profile: 'email' })
    expect(comment).not.toBeNull()
    expect(email).not.toBeNull()
    expect(comment).not.toBe(email)
    expect(comment?.compiled).toContain('icon-link')
    expect(email?.compiled).not.toContain('icon-link')
  })

  it('normalises CRLF before hashing', async () => {
    const a = await compileMarkdown('line one\nline two', { profile: 'comment' })
    const b = await compileMarkdown('line one\r\nline two', { profile: 'comment' })
    expect(a).toBe(b)
  })
})
