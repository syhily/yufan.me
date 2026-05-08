import fastGlob from 'fast-glob'
import { execSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { AdminMusicDto } from '@/shared/music'

import { addMusic } from '@/server/music/service'

// One-shot historical import:
//   1. Scan `src/content/{posts,pages}/**/*.mdx` for
//      `<MusicPlayer id={<digits>}` references.
//   2. For each unique `sourceId`, call `addMusic({ source: 'netease',
//      sourceId, prefill })`. The prefill is built from the legacy
//      `https://cat.yufan.me/musics/<id>.json` payload when available,
//      so we reuse the historical url/pic/lyric without round-tripping
//      to meting netease for every song.
//   3. ATOMIC: only after every single sourceId imports cleanly do we
//      rewrite any MDX file. A single failure = zero MDX changes; the
//      operator gets a `tmp/music-import-failed.json` to investigate.
//   4. Finally rewrite every MDX `<MusicPlayer id={<sourceId>}` to
//      `<MusicPlayer id="<playerId>"` and print a summary.
//
// Run with `npm run import-music -- --apply` (or `--dry-run` to
// preview). The script aborts when `git status` reports unstaged
// changes under `src/content/` unless `--allow-dirty` is passed.

interface CliFlags {
  apply: boolean
  allowDirty: boolean
}

interface MdxOccurrence {
  filePath: string
  sourceId: string
}

interface ImportFailure {
  sourceId: string
  reason: string
}

interface LegacyJsonPayload {
  name?: string
  artist?: string
  album?: string
  url?: string
  pic?: string
  lyric?: string
}

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..')
const MDX_GLOBS = ['src/content/posts/**/*.mdx', 'src/content/pages/**/*.mdx']
const LEGACY_JSON_BASE = 'https://cat.yufan.me/musics'
const MUSIC_PLAYER_REGEX_GLOBAL = /<MusicPlayer\s+id=\{(\d+)\}/g

function parseFlags(): CliFlags {
  const argv = process.argv.slice(2)
  return {
    apply: argv.includes('--apply'),
    allowDirty: argv.includes('--allow-dirty'),
  }
}

function ensureCleanContentDir(): void {
  let result: string
  try {
    result = execSync('git status --porcelain -- src/content', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    })
  } catch (error) {
    throw new Error(
      `git status check failed: ${error instanceof Error ? error.message : String(error)}. ` +
        `Pass --allow-dirty if this is not a git repo.`,
    )
  }
  if (result.trim() !== '') {
    throw new Error(
      'src/content has uncommitted changes. Commit or stash them first, ' +
        'or pass --allow-dirty to bypass this check.\n' +
        result,
    )
  }
}

async function scanMdxOccurrences(): Promise<MdxOccurrence[]> {
  const files = await fastGlob(MDX_GLOBS, { cwd: PROJECT_ROOT, absolute: true })
  const occurrences: MdxOccurrence[] = []
  for (const filePath of files) {
    const text = await readFile(filePath, 'utf8')
    MUSIC_PLAYER_REGEX_GLOBAL.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = MUSIC_PLAYER_REGEX_GLOBAL.exec(text)) !== null) {
      occurrences.push({ filePath, sourceId: match[1] })
    }
  }
  return occurrences
}

async function fetchLegacyJson(sourceId: string): Promise<LegacyJsonPayload | null> {
  const url = `${LEGACY_JSON_BASE}/${sourceId}.json`
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    return null
  }
  if (!response.ok) {
    return null
  }
  try {
    return (await response.json()) as LegacyJsonPayload
  } catch {
    return null
  }
}

function legacyJsonToPrefill(json: LegacyJsonPayload | null): {
  name?: string
  artist?: string[]
  album?: string
  audioUrl?: string
  coverUrl?: string
  lyric?: string | null
} {
  if (json === null) {
    return {}
  }
  return {
    name: typeof json.name === 'string' && json.name !== '' ? json.name : undefined,
    artist: typeof json.artist === 'string' && json.artist !== '' ? splitArtist(json.artist) : undefined,
    album: typeof json.album === 'string' && json.album !== '' ? json.album : undefined,
    audioUrl: typeof json.url === 'string' && json.url !== '' ? json.url : undefined,
    coverUrl: typeof json.pic === 'string' && json.pic !== '' ? json.pic : undefined,
    // Empty-string lyric in the legacy JSON means "the player should
    // load the lyric file separately"; that's no longer supported, so
    // leave it `undefined` to fall back to a meting lookup.
    lyric: typeof json.lyric === 'string' && json.lyric !== '' ? json.lyric : undefined,
  }
}

function splitArtist(packed: string): string[] {
  return packed
    .split(/[/&,]/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
}

async function importOne(sourceId: string): Promise<AdminMusicDto> {
  const legacy = await fetchLegacyJson(sourceId)
  return addMusic({
    source: 'netease',
    sourceId,
    uploader: null,
    prefill: legacyJsonToPrefill(legacy),
  })
}

function relativize(absolutePath: string): string {
  return path.relative(PROJECT_ROOT, absolutePath)
}

async function rewriteMdx(occurrences: MdxOccurrence[], idMap: Map<string, string>): Promise<void> {
  // Group by file so each MDX is read + rewritten once.
  const byFile = new Map<string, string[]>()
  for (const occ of occurrences) {
    const list = byFile.get(occ.filePath) ?? []
    list.push(occ.sourceId)
    byFile.set(occ.filePath, list)
  }
  for (const [filePath, sourceIds] of byFile) {
    const original = await readFile(filePath, 'utf8')
    const updated = original.replace(MUSIC_PLAYER_REGEX_GLOBAL, (full, sourceId: string) => {
      const playerId = idMap.get(sourceId)
      if (playerId === undefined) {
        return full
      }
      return full.replace(`id={${sourceId}}`, `id="${playerId}"`)
    })
    if (updated !== original) {
      await writeFile(filePath, updated, 'utf8')
      const summary = sourceIds.map((sid) => `${sid} → ${idMap.get(sid) ?? '(unchanged)'}`).join(', ')
      console.log(`  ${relativize(filePath)}: ${summary}`)
    }
  }
}

async function writeFailures(failures: ImportFailure[]): Promise<void> {
  const tmpDir = path.join(PROJECT_ROOT, 'tmp')
  await mkdir(tmpDir, { recursive: true })
  const tmpPath = path.join(tmpDir, 'music-import-failed.json')
  await writeFile(tmpPath, JSON.stringify(failures, null, 2), 'utf8')
  console.error(`Failure report written to ${relativize(tmpPath)}`)
}

async function main(): Promise<void> {
  const flags = parseFlags()

  if (!flags.allowDirty) {
    ensureCleanContentDir()
  }

  const occurrences = await scanMdxOccurrences()
  const uniqueSourceIds = [...new Set(occurrences.map((occ) => occ.sourceId))]
  console.log(
    `Scanned ${occurrences.length} <MusicPlayer> occurrence(s) across MDX content; ` +
      `${uniqueSourceIds.length} unique sourceId(s).`,
  )

  if (uniqueSourceIds.length === 0) {
    console.log('Nothing to do.')
    return
  }

  if (!flags.apply) {
    console.log('Dry run (no DB / S3 / MDX changes). Re-run with --apply to commit.')
    for (const occ of occurrences) {
      console.log(`  ${relativize(occ.filePath)}: would import sourceId=${occ.sourceId}`)
    }
    return
  }

  // Phase 1: import every unique sourceId. We collect failures
  // instead of bailing early so the operator can see the full
  // landscape (e.g. three songs went away on netease at once).
  const idMap = new Map<string, string>()
  const failures: ImportFailure[] = []
  let imported = 0
  let skipped = 0
  for (const sourceId of uniqueSourceIds) {
    try {
      const dto = await importOne(sourceId)
      idMap.set(sourceId, dto.playerId)
      imported += 1
      console.log(`  + ${sourceId} → ${dto.playerId} (${dto.name})`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      failures.push({ sourceId, reason })
      console.error(`  ! ${sourceId} failed: ${reason}`)
      skipped += 1
    }
  }

  if (failures.length > 0) {
    await writeFailures(failures)
    console.error(`\n${failures.length} failure(s); MDX files left untouched.`)
    process.exit(1)
  }

  // Phase 2: rewrite MDX in one atomic pass once every sourceId
  // resolved to a playerId.
  console.log(`\nAll ${imported} song(s) imported (${skipped} skipped). Rewriting MDX:`)
  await rewriteMdx(occurrences, idMap)
  console.log('\nDone.')
}

await main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
