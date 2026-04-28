/**
 * Scan MDX + meta YAML for asset-host image URLs, download sidecar `*.json`
 * metadata from the CDN, and write one file per image under
 * `src/content/image-metadata/` (path mirrors the URL pathname).
 *
 * Usage: `npm run image:metadata:sync`
 *
 * Non-image asset URLs (e.g. `.pdf`) are skipped — they have no image metadata JSON.
 * If some image links 404 on the CDN, use `npm run image:metadata:sync -- --continue-on-error`
 * to still exit 0 after logging failures (default: exit 1 when any fetch fails).
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import config from '../src/blog.config.ts'
import {
  committedImageMetadataFilePath,
  isCommittedMetadataHostUrl,
  metadataJsonUrlForImageSrc,
  parseImageMetadataRecord,
} from '../src/server/images/metadata-store.ts'

const FETCH_TIMEOUT_MS = 1500
const CONCURRENCY = 16

const assetHost = config.settings.asset.host

/** Pathnames must end with one of these — PDFs and other uploads are ignored. */
const IMAGE_METADATA_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.jxl',
  '.png',
  '.svg',
  '.webp',
])

const continueOnError = process.argv.includes('--continue-on-error')

function pathnameHasImageMetadataExtension(url: string): boolean {
  try {
    const pathname = new URL(url).pathname
    const segment = pathname.split('/').pop() ?? ''
    const dot = segment.lastIndexOf('.')
    if (dot === -1) return false
    return IMAGE_METADATA_EXTENSIONS.has(segment.slice(dot).toLowerCase())
  } catch {
    return false
  }
}

async function collectFiles(root: string, extension: string): Promise<string[]> {
  const out: string[] = []
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const full = resolve(root, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(full, extension)))
    } else if (entry.isFile() && full.endsWith(extension)) {
      out.push(full)
    }
  }
  return out
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractAssetUrls(text: string): string[] {
  const re = new RegExp(`https?://${escapeRegExp(assetHost)}[^)\\s"'<>]+`, 'g')
  const found: string[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    let url = match[0]
    url = url.replace(/[),.;]+$/, '')
    if (isCommittedMetadataHostUrl(url) && pathnameHasImageMetadataExtension(url)) {
      found.push(url)
    }
  }
  return found
}

async function urlsFromTextFile(path: string): Promise<string[]> {
  const text = await readFile(path, 'utf8')
  return extractAssetUrls(text)
}

async function run(): Promise<void> {
  const cwd = process.cwd()
  const postsDir = resolve(cwd, 'src/content/posts')
  const pagesDir = resolve(cwd, 'src/content/pages')
  const metasDir = resolve(cwd, 'src/content/metas')

  const mdxFiles = [...(await collectFiles(postsDir, '.mdx')), ...(await collectFiles(pagesDir, '.mdx'))]
  const yamlFiles = (await collectFiles(metasDir, '.yaml')).filter((p) => p.endsWith('.yaml'))

  const urlSet = new Set<string>()
  for (const file of mdxFiles) {
    for (const u of await urlsFromTextFile(file)) {
      urlSet.add(u)
    }
  }
  for (const file of yamlFiles) {
    for (const u of await urlsFromTextFile(file)) {
      urlSet.add(u)
    }
  }

  const queue = [...urlSet].sort()
  console.log(`Found ${queue.length} unique asset-host image URLs.`)

  type Outcome = 'skipped' | 'written' | 'failed'

  async function handleOne(url: string): Promise<Outcome> {
    const outPath = committedImageMetadataFilePath(url)
    const jsonUrl = metadataJsonUrlForImageSrc(url)
    if (outPath === null || jsonUrl === null) return 'failed'

    try {
      const existing = await readFile(outPath, 'utf8')
      if (parseImageMetadataRecord(JSON.parse(existing) as unknown) !== null) {
        return 'skipped'
      }
    } catch {
      // missing or invalid — fetch
    }

    try {
      const response = await fetch(jsonUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (!response.ok) {
        console.error(`FAIL ${url} -> ${response.status}`)
        return 'failed'
      }
      const raw: unknown = await response.json()
      const parsed = parseImageMetadataRecord(raw)
      if (parsed === null) {
        console.error(`FAIL invalid metadata JSON for ${url}`)
        return 'failed'
      }
      await mkdir(dirname(outPath), { recursive: true })
      await writeFile(outPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
      return 'written'
    } catch (err) {
      console.error(`FAIL fetch ${url}`, err)
      return 'failed'
    }
  }

  async function worker(): Promise<{ written: number; skipped: number; failed: number }> {
    let written = 0
    let skipped = 0
    let failed = 0
    while (queue.length > 0) {
      const url = queue.shift()
      if (url === undefined) break
      const o = await handleOne(url)
      if (o === 'written') written += 1
      else if (o === 'skipped') skipped += 1
      else failed += 1
    }
    return { written, skipped, failed }
  }

  const workerCount = queue.length === 0 ? 0 : Math.min(CONCURRENCY, queue.length)
  const parts = await Promise.all(Array.from({ length: workerCount }, () => worker()))
  const written = parts.reduce((a, p) => a + p.written, 0)
  const skipped = parts.reduce((a, p) => a + p.skipped, 0)
  const failed = parts.reduce((a, p) => a + p.failed, 0)

  console.log(`Done. written=${written} skipped=${skipped} failed=${failed}`)
  if (failed > 0 && !continueOnError) {
    process.exitCode = 1
  }
}

await run()
