import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'

function contentFiles(): string[] {
  const out = execFileSync('rg', ['--files', 'src/content', '-g', '*.mdx', '-g', '*.md'], {
    encoding: 'utf8',
  }).trim()
  return out === '' ? [] : out.split('\n')
}

describe('contract: content markup', () => {
  it('does not wrap bare URL text in raw HTML anchors', () => {
    const offenders: string[] = []
    const anchorRe = /<a\b[^>]*\bhref=(["'])(https?:\/\/[^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi

    for (const file of contentFiles()) {
      const source = readFileSync(file, 'utf8')
      let match: RegExpExecArray | null
      while ((match = anchorRe.exec(source)) !== null) {
        const label = match[3].replace(/<[^>]*>/g, '').trim()
        if (label === match[2]) {
          const line = source.slice(0, match.index).split('\n').length
          offenders.push(`${file}:${line} ${match[2]}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
