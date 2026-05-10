// @ts-nocheck
// CLI: migrate an MDX post corpus into the DB-backed `post` + `content` tables.
//
// Run with:
//   vp dlx vite-node --env-file=.env scripts/migrate/posts/cli.ts --source-dir <abs-path>
//   vp dlx vite-node --env-file=.env scripts/migrate/posts/cli.ts --source-dir <abs-path> --apply

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'

import { findPostMetaBySlug } from '@/server/cms/posts/repository'
import { createPost, publishLatest } from '@/server/cms/posts/service'
import { findImageByStoragePath } from '@/server/db/query/image'
import { findMusicByPlayerId } from '@/server/db/query/music'
import { resolveSrcToStoragePath } from '@/server/images/render-enhance'
import { getPublicBaseUrl } from '@/server/images/storage'
import { getLogger } from '@/server/logger'
import { hydrateBlogSettings } from '@/server/settings/snapshot'

import { convertPostMdxToPortableText, type MigratePostMdxOptions } from './mdx-to-portable-text.ts'

const log = getLogger('scripts.migrate.posts')

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
  visible?: boolean
  category?: string
  tags?: string[]
  alias?: string[]
}

interface PerPostReport {
  slug: string
  title: string
  status: 'created' | 'skipped' | 'failed' | 'dry-run'
  unresolvedImages: string[]
  missingMusicPlayers: string[]
}

interface CliFlags {
  sourceDir: string
  apply: boolean
  force: boolean
}

function parseCliFlags(argv: readonly string[]): CliFlags {
  const apply = argv.includes('--apply')
  const force = argv.includes('--force')
  const sourceDirIdx = argv.indexOf('--source-dir')
  if (sourceDirIdx === -1 || sourceDirIdx === argv.length - 1) {
    throw new Error('`--source-dir <abs-path>` is required.')
  }
  return { apply, force, sourceDir: path.resolve(argv[sourceDirIdx + 1]) }
}

async function listMdxFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile() && entry.name.endsWith('.mdx') && !entry.name.startsWith('_')) {
        out.push(full)
      }
    }
  }
  await walk(dir)
  return out.sort()
}

function splitFrontmatter(source: string): { frontmatter: string; body: string } | null {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (match === null) {
    return null
  }
  return { frontmatter: match[1], body: match[2] }
}

function parseDate(input: string | undefined): Date {
  if (input === undefined || input === '') {
    return new Date()
  }
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) {
    return new Date()
  }
  return d
}

export async function main(argv: readonly string[]): Promise<void> {
  const flags = parseCliFlags(argv)
  await hydrateBlogSettings()

  const files = await listMdxFiles(flags.sourceDir)
  log.info(`Found ${files.length} MDX files in ${flags.sourceDir}`)

  const reports: PerPostReport[] = []

  for (const file of files) {
    const raw = await readFile(file, 'utf8')
    const split = splitFrontmatter(raw)
    if (split === null) {
      reports.push({
        slug: path.basename(file),
        title: '',
        status: 'failed',
        unresolvedImages: [],
        missingMusicPlayers: [],
      })
      continue
    }

    const fm = parseYaml(split.frontmatter) as MdxFrontmatter
    const bodySource = split.body

    const resolveImageBySrc: MigratePostMdxOptions['resolveImageBySrc'] = async (src) => {
      const storagePath = resolveSrcToStoragePath(src, getPublicBaseUrl())
      if (storagePath === null) {
        return null
      }
      return findImageByStoragePath(storagePath)
    }

    let conversion: Awaited<ReturnType<typeof convertPostMdxToPortableText>>
    try {
      conversion = await convertPostMdxToPortableText(bodySource, { resolveImageBySrc })
    } catch (error) {
      log.error(`Conversion failed for ${fm.slug}: ${String(error)}`)
      reports.push({ slug: fm.slug, title: fm.title, status: 'failed', unresolvedImages: [], missingMusicPlayers: [] })
      continue
    }

    // Sanity-check music player ids
    const missingMusicIds: string[] = []
    for (const id of conversion.musicPlayerIds) {
      if (!(await findMusicByPlayerId(id))) {
        missingMusicIds.push(id)
      }
    }

    const existing = await findPostMetaBySlug(fm.slug)
    if (existing && !flags.force) {
      reports.push({
        slug: fm.slug,
        title: fm.title,
        status: 'skipped',
        unresolvedImages: conversion.unresolvedImages,
        missingMusicPlayers: missingMusicIds,
      })
      continue
    }

    if (!flags.apply) {
      reports.push({
        slug: fm.slug,
        title: fm.title,
        status: 'dry-run',
        unresolvedImages: conversion.unresolvedImages,
        missingMusicPlayers: missingMusicIds,
      })
      continue
    }

    try {
      const post = await createPost(
        {
          slug: fm.slug,
          title: fm.title,
          summary: fm.summary ?? '',
          cover: fm.cover ?? '',
          og: fm.og ?? null,
          published: fm.published ?? true,
          commentsEnabled: fm.comments ?? true,
          showToc: fm.toc ?? false,
          visible: fm.visible ?? true,
          publishedAt: parseDate(fm.date),
          category: fm.category ?? '',
          tags: fm.tags ?? [],
          alias: fm.alias ?? [],
        },
        null,
      )

      const publishResult = await publishLatest({
        postId: BigInt(post.id),
        body: conversion.body,
        authorId: null,
        publishedAt: parseDate(fm.date),
      })

      if (publishResult.status !== 'saved') {
        reports.push({
          slug: fm.slug,
          title: fm.title,
          status: 'failed',
          unresolvedImages: conversion.unresolvedImages,
          missingMusicPlayers: missingMusicIds,
        })
      } else {
        reports.push({
          slug: fm.slug,
          title: fm.title,
          status: 'created',
          unresolvedImages: conversion.unresolvedImages,
          missingMusicPlayers: missingMusicIds,
        })
      }
    } catch (error) {
      log.error(`Create/publish failed for ${fm.slug}: ${String(error)}`)
      reports.push({
        slug: fm.slug,
        title: fm.title,
        status: 'failed',
        unresolvedImages: conversion.unresolvedImages,
        missingMusicPlayers: missingMusicIds,
      })
    }
  }

  // Summary
  const created = reports.filter((r) => r.status === 'created').length
  const skipped = reports.filter((r) => r.status === 'skipped').length
  const failed = reports.filter((r) => r.status === 'failed').length
  const dryRun = reports.filter((r) => r.status === 'dry-run').length

  console.log(`\nMigration summary:`)
  console.log(`  Created: ${created}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed:  ${failed}`)
  console.log(`  Dry-run: ${dryRun}`)

  for (const r of reports) {
    if (r.unresolvedImages.length > 0) {
      console.log(`  [${r.slug}] Unresolved images: ${r.unresolvedImages.join(', ')}`)
    }
    if (r.missingMusicPlayers.length > 0) {
      console.log(`  [${r.slug}] Missing music players: ${r.missingMusicPlayers.join(', ')}`)
    }
  }
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err)
  process.exit(1)
})
