// One-shot CLI: migrate `src/content/pages/*.mdx` into the
// DB-backed `page` + `content` tables.
//
// Run with:
//
//   vp dlx vite-node --env-file=.env scripts/migrate-mdx-pages.ts          # dry run
//   vp dlx vite-node --env-file=.env scripts/migrate-mdx-pages.ts --apply  # actually write
//   vp dlx vite-node --env-file=.env scripts/migrate-mdx-pages.ts --apply --force  # ignore the "already in DB" idempotency guard
//
// The script never deletes the source MDX file — the catalog already
// prefers DB rows over MDX of the same slug
// (`buildDbPage(...).filter((p) => !dbPageSlugs.has(p.slug))` in
// `@/server/catalog/catalog`), so the MDX stays as a fail-safe in
// case the migration needs to be re-run or rolled back.
//
// What this script does:
//
//   1. Walk every `src/content/pages/*.mdx`.
//   2. Parse YAML frontmatter (title / slug / date / cover / summary
//      / published / comments / toc / og).
//   3. Run the body through `convertMdxBodyToPortableText` from
//      `@/server/cms/pages/migrate-mdx`. The converter knows about
//      paragraphs, headings, lists, blockquotes, images,
//      `<MusicPlayer>` and `<Friends />`, and throws on anything
//      richer (so a future MDX page that grows a fenced code block
//      or a table can't silently lose content).
//   4. Resolve cover URL + every inline image URL through
//      `resolveSrcToStoragePath` + `findImageByStoragePath` so the
//      saved PortableText carries `storagePath` / width / height /
//      thumbhash where possible. Misses go in the per-page report
//      and the bare URL stays in the body.
//   5. Sanity-check every `<MusicPlayer id="...">` against the
//      `music` table. Misses log a warning but don't abort — the
//      runtime resolver already 404s gracefully.
//   6. Call `createPage` + `publishLatest` (or skip when the slug
//      already exists in the `page` table).
//   7. Print a summary: created / skipped / failed pages,
//      unresolved-image URLs (per page), missing music player ids
//      (per page).

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

import { convertMdxBodyToPortableText, type MigrateMdxOptions } from '@/server/cms/pages/migrate-mdx'
import { findPageMetaBySlug } from '@/server/cms/pages/repository'
import { createPage, publishLatest } from '@/server/cms/pages/service'
import { findImageByStoragePath } from '@/server/db/query/image'
import { findMusicByPlayerId } from '@/server/db/query/music'
import { resolveSrcToStoragePath } from '@/server/images/render-enhance'
import { getPublicBaseUrl } from '@/server/images/storage'
import { getLogger } from '@/server/logger'
import { hydrateBlogSettings } from '@/server/settings/snapshot'

const log = getLogger('scripts.migrate-mdx-pages')

interface MdxFrontmatter {
  title: string
  slug: string
  date: string
  updated?: string
  summary?: string
  cover?: string
  og?: string
  published?: boolean
  comments?: boolean
  toc?: boolean
}

interface PerPageReport {
  slug: string
  title: string
  status: 'created' | 'skipped' | 'failed' | 'dry-run'
  unresolvedImages: string[]
  missingMusicPlayers: string[]
  /**
   * True when the original MDX body contained a `<Friends />` JSX
   * tag. The migrator strips the tag from the source before the
   * converter runs and pre-toggles `page.show_friends=true` on the
   * inserted row so the meta switch reproduces the original visual
   * outcome (`links.mdx` is the canonical opt-in). The body itself
   * never carries a `friends` block — that PortableText type was
   * retired together with this flag's introduction.
   */
  showFriendsAuto: boolean
  error?: string
}

interface CliFlags {
  apply: boolean
  force: boolean
}

function parseCliFlags(argv: readonly string[]): CliFlags {
  const apply = argv.includes('--apply')
  const force = argv.includes('--force')
  return { apply, force }
}

async function listMdxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const out: string[] = []
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }
    if (!entry.name.endsWith('.mdx')) {
      continue
    }
    if (entry.name.startsWith('_')) {
      continue
    }
    out.push(path.join(dir, entry.name))
  }
  return out.sort()
}

function splitFrontmatter(raw: string): { frontmatter: MdxFrontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (match === null) {
    throw new Error('Missing YAML frontmatter block (must start with `---`).')
  }
  const yamlText = match[1]
  const body = match[2]
  const data = parseYaml(yamlText) as Record<string, unknown> | null
  if (data === null || typeof data !== 'object') {
    throw new Error('Frontmatter YAML did not parse to an object.')
  }
  const fm = data as unknown as MdxFrontmatter
  if (typeof fm.title !== 'string' || typeof fm.slug !== 'string' || typeof fm.date !== 'string') {
    throw new Error('Frontmatter must contain `title`, `slug`, and `date`.')
  }
  return { frontmatter: fm, body }
}

// Detect-and-strip every `<Friends />` self-closing JSX tag from the
// raw MDX body. Returns the stripped body alongside the number of
// matches removed so the caller can flip `page.show_friends` and log
// the action. We do a single regex pass (no AST round-trip) — the
// migration corpus is tiny and the tag shape is stable. The matched
// region eats trailing whitespace and at most one trailing newline so
// the surrounding paragraph spacing stays sensible after the strip.
function stripFriendsTag(body: string): { body: string; removed: number } {
  let removed = 0
  const stripped = body.replace(/<Friends\s*\/>\s*\n?/g, () => {
    removed += 1
    return ''
  })
  return { body: stripped, removed }
}

// Build the resolver the converter calls per `<img src>`. The
// resolver is closure-built per CLI run so we can capture the
// publicBaseUrl once. Returning `null` means "no `image` row in DB"
// — the converter records the miss in `unresolvedImages` and leaves
// the bare URL on the block.
function buildImageResolver(publicBaseUrl: string | null): MigrateMdxOptions['resolveImageBySrc'] {
  return async (src: string) => {
    const storagePath = resolveSrcToStoragePath(src, publicBaseUrl)
    if (storagePath === null) {
      return null
    }
    const row = await findImageByStoragePath(storagePath)
    if (row === null) {
      return null
    }
    const tail = row.storagePath.startsWith('/') ? row.storagePath.slice(1) : row.storagePath
    const publicUrl = publicBaseUrl === null ? row.storagePath : `${publicBaseUrl}/${tail}?v=${row.updatedAt.getTime()}`
    return {
      storagePath: row.storagePath,
      width: row.width,
      height: row.height,
      thumbhash: row.thumbhash,
      publicUrl,
    }
  }
}

async function resolveCover(rawCover: string | undefined, publicBaseUrl: string | null): Promise<string> {
  // The DB `page.cover` is an `text NOT NULL DEFAULT ''` column.
  // When the MDX cover is empty / missing, we persist '' so the
  // admin can paste one later.
  if (rawCover === undefined || rawCover === '') {
    return ''
  }
  const storagePath = resolveSrcToStoragePath(rawCover, publicBaseUrl)
  if (storagePath === null) {
    // Cover URL doesn't match any S3 host — keep verbatim. The
    // historical MDX corpus uses absolute `stage-asset.yufan.me` URLs which
    // do match the S3 host, so this branch is rare.
    return rawCover
  }
  const row = await findImageByStoragePath(storagePath)
  if (row === null) {
    return rawCover
  }
  if (publicBaseUrl === null) {
    return row.storagePath
  }
  const tail = row.storagePath.startsWith('/') ? row.storagePath.slice(1) : row.storagePath
  return `${publicBaseUrl}/${tail}?v=${row.updatedAt.getTime()}`
}

async function migrateOne(filePath: string, flags: CliFlags, publicBaseUrl: string | null): Promise<PerPageReport> {
  const fileName = path.basename(filePath)
  const raw = await readFile(filePath, 'utf-8')
  const { frontmatter, body: mdxBody } = splitFrontmatter(raw)

  const report: PerPageReport = {
    slug: frontmatter.slug,
    title: frontmatter.title,
    status: 'failed',
    unresolvedImages: [],
    missingMusicPlayers: [],
    showFriendsAuto: false,
  }

  // Idempotency: if the slug is already in the page table, skip
  // (unless --force, which still won't update — it just emits the
  // would-be payload as a dry-run summary so the operator can see
  // what diverged).
  const existing = await findPageMetaBySlug(frontmatter.slug)
  if (existing !== null && !flags.force) {
    report.status = 'skipped'
    log.info('migrate.skipped (slug already in DB)', {
      file: fileName,
      slug: frontmatter.slug,
      pageMetaId: existing.id.toString(),
    })
    return report
  }

  // Strip `<Friends />` from the MDX BEFORE converting. The friends
  // grid no longer lives inside the body — `routes/page.detail.tsx`
  // renders it from the meta toggle (`page.show_friends`). The
  // converter intentionally has no `<Friends />` arm, so anything
  // that survived this strip would land in the unsupported-raw-HTML
  // error path. We use a single regex pass (no AST round-trip) so
  // the strip stays localised to this script.
  const stripped = stripFriendsTag(mdxBody)
  report.showFriendsAuto = stripped.removed > 0
  if (report.showFriendsAuto) {
    log.warn('migrate.show_friends_auto', {
      file: fileName,
      slug: frontmatter.slug,
      removed: stripped.removed,
      hint: 'MDX 中检测到 <Friends />，迁移后 page.show_friends 会被置为 true，body 不再保留对应内容。',
    })
  }

  const resolveImageBySrc = buildImageResolver(publicBaseUrl)

  let conversion
  try {
    conversion = await convertMdxBodyToPortableText(stripped.body, { resolveImageBySrc })
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error)
    log.error('migrate.convert_failed', { file: fileName, slug: frontmatter.slug, error: report.error })
    return report
  }

  report.unresolvedImages = conversion.unresolvedImages

  // Pre-flight music player ids: the runtime falls back gracefully
  // for unknown ids, but the migrator should still surface a missing
  // music row so the operator notices BEFORE the page goes live.
  for (const playerId of conversion.musicPlayerIds) {
    const row = await findMusicByPlayerId(playerId)
    if (row === null) {
      report.missingMusicPlayers.push(playerId)
      log.warn('migrate.music_missing', {
        file: fileName,
        slug: frontmatter.slug,
        playerId,
      })
    }
  }

  const cover = await resolveCover(frontmatter.cover, publicBaseUrl)

  if (!flags.apply) {
    report.status = 'dry-run'
    log.info('migrate.dry_run', {
      file: fileName,
      slug: frontmatter.slug,
      blocks: conversion.body.length,
      unresolvedImages: report.unresolvedImages.length,
      missingMusicPlayers: report.missingMusicPlayers.length,
      coverUnresolved: cover === (frontmatter.cover ?? ''),
      showFriendsAuto: report.showFriendsAuto,
    })
    return report
  }

  const publishedAt = parseDate(frontmatter.date)

  try {
    const created = await createPage(
      {
        slug: frontmatter.slug,
        title: frontmatter.title,
        summary: frontmatter.summary ?? '',
        cover,
        og: frontmatter.og ?? null,
        published: frontmatter.published ?? true,
        commentsEnabled: frontmatter.comments ?? true,
        showToc: frontmatter.toc ?? false,
        showFriends: report.showFriendsAuto,
        publishedAt,
      },
      null,
    )

    const result = await publishLatest({
      pageId: BigInt(created.id),
      body: conversion.body,
      authorId: null,
      publishedAt,
    })

    if (result.status !== 'saved') {
      report.error = `publishLatest returned status='${result.status}'`
      report.status = 'failed'
      log.error('migrate.publish_unexpected', { file: fileName, slug: frontmatter.slug, status: result.status })
      return report
    }

    report.status = 'created'
    log.info('migrate.created', {
      file: fileName,
      slug: frontmatter.slug,
      pageMetaId: created.id,
      revisionId: result.revision.id,
    })
    return report
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error)
    log.error('migrate.write_failed', { file: fileName, slug: frontmatter.slug, error: report.error })
    return report
  }
}

function parseDate(value: string): Date {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date in frontmatter: '${value}'`)
  }
  return d
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2))

  // Hydrate blog settings so `getPublicBaseUrl()` (for image
  // resolution) and the slug derivation (`@/server/slug`) have a
  // valid bundle to read from. The DB pool is opened lazily by the
  // first query.
  await hydrateBlogSettings()

  let publicBaseUrl: string | null = null
  try {
    publicBaseUrl = getPublicBaseUrl()
  } catch (error) {
    log.warn('migrate.public_base_url_missing', {
      hint: '`assets.storage.publicBaseUrl` is not configured; image resolution will skip every URL.',
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const here = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(here, '..')
  const pagesDir = path.join(repoRoot, 'src/content/pages')

  const files = await listMdxFiles(pagesDir)
  if (files.length === 0) {
    log.info('migrate.no_pages', { pagesDir })
    return
  }

  log.info('migrate.start', {
    pages: files.length,
    apply: flags.apply,
    force: flags.force,
    publicBaseUrl: publicBaseUrl ?? '(none)',
  })

  const reports: PerPageReport[] = []
  for (const file of files) {
    try {
      reports.push(await migrateOne(file, flags, publicBaseUrl))
    } catch (error) {
      const slug = path.basename(file, '.mdx')
      reports.push({
        slug,
        title: '(unread)',
        status: 'failed',
        unresolvedImages: [],
        missingMusicPlayers: [],
        showFriendsAuto: false,
        error: error instanceof Error ? error.message : String(error),
      })
      log.error('migrate.read_failed', { file, error })
    }
  }

  printSummary(reports, flags)
}

function printSummary(reports: readonly PerPageReport[], flags: CliFlags): void {
  const created = reports.filter((r) => r.status === 'created').length
  const skipped = reports.filter((r) => r.status === 'skipped').length
  const failed = reports.filter((r) => r.status === 'failed').length
  const dryRun = reports.filter((r) => r.status === 'dry-run').length

  log.info('migrate.summary', { created, skipped, failed, dryRun, applyMode: flags.apply })

  for (const report of reports) {
    if (report.unresolvedImages.length > 0) {
      log.warn('migrate.unresolved_images', {
        slug: report.slug,
        count: report.unresolvedImages.length,
        urls: report.unresolvedImages,
        hint: '操作员请到 /wp-admin/images 把这些 URL 对应的资源补到 image 表，或确认它们就是 S3 之外的外链。',
      })
    }
    if (report.missingMusicPlayers.length > 0) {
      log.warn('migrate.missing_music_players', {
        slug: report.slug,
        playerIds: report.missingMusicPlayers,
        hint: '操作员请到 /wp-admin/musics 添加对应的音乐行（playerId 是 16 位 [a-z0-9] 不可手编）。',
      })
    }
    if (report.showFriendsAuto) {
      log.warn('migrate.report.show_friends_auto', {
        slug: report.slug,
        hint:
          '迁移已自动设置 page.show_friends=true，对应的 <Friends /> JSX 已经从 body 中剥离。' +
          '若需要禁用页面底部的友链网格，请到 /wp-admin/pages 编辑该页关闭此开关。',
      })
    }
    if (report.error !== undefined) {
      log.error('migrate.report.failed', { slug: report.slug, error: report.error })
    }
  }
}

await main()
