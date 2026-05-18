import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

const here = dirname(fileURLToPath(import.meta.url))

function readSource(relPath: string): string {
  return readFileSync(resolve(here, relPath), 'utf8')
}

const clientSource = readSource('../src/client/api/client.ts')
const adminLayoutSource = readSource('../src/routes/admin/layout.tsx')
const postDetailSource = readSource('../src/routes/public/post/detail.tsx')
const pageDetailSource = readSource('../src/routes/public/page/detail.tsx')

describe('contract: CSRF meta tag shape', () => {
  it('renders a single meta tag with name="csrf-token" in admin layout', () => {
    expect(adminLayoutSource).toContain('<meta name="csrf-token"')
    expect(adminLayoutSource).toContain('content={loaderData.csrfToken}')
  })

  it('renders a single meta tag with name="csrf-token" in post detail', () => {
    expect(postDetailSource).toContain('<meta name="csrf-token"')
    expect(postDetailSource).toContain('content={detail.csrfToken}')
  })

  it('renders a single meta tag with name="csrf-token" in page detail', () => {
    expect(pageDetailSource).toContain('<meta name="csrf-token"')
    expect(pageDetailSource).toContain('content={detail.csrfToken}')
  })

  it('client-side setCsrfToken synchronises both memory and DOM meta', () => {
    expect(clientSource).toContain('export function setCsrfToken')
    // Memory write
    expect(clientSource).toContain('csrfToken = token')
    // DOM sync
    expect(clientSource).toContain('meta[name="csrf-token"]')
    expect(clientSource).toContain('meta.content = token')
  })

  it('client-side readCsrfMeta reads from the same meta selector', () => {
    expect(clientSource).toContain('export function readCsrfMeta')
    expect(clientSource).toContain('meta[name="csrf-token"]')
  })
})
