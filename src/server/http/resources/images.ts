import type { Context } from 'hono'

import { Hono } from 'hono'
import crypto from 'node:crypto'

import { AvatarStatus, cacheAvatar, loadAvatar } from '@/server/cache/avatar'
import { loadBuffer } from '@/server/cache/image'
import { getEntryBySlug } from '@/server/catalog'
import {
  defaultAvatarUrl,
  fetchAvatarImage,
  fetchQQAvatarImage,
  isQQEmail,
  resolveAvatarInfo,
} from '@/server/images/avatar-fetch'
import { drawOpenGraph } from '@/server/images/og'
import { serveCalendar } from '@/server/images/serve-calendar'
import { findPageBySlug } from '@/server/pages/query'
import { findPostBySlug } from '@/server/posts/query'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { joinUrl } from '@/shared/urls'

import type { Env } from '../context'

// ─── OG image ─────────────────────────────────────────────────────

function ogCacheKey(slug: string, title: string, summary: string, cover: string): string {
  const hash = crypto.createHash('sha1').update(`${title}\u0001${summary}\u0001${cover}`).digest('hex').slice(0, 16)
  return `${requireBlogSettingsSection('cache').cache.og.prefix}${slug}-${hash}`
}

const OG_HEADERS: HeadersInit = {
  'Cache-Control': 'public, max-age=604800, immutable',
}

function ogFallback(c: Context<Env>) {
  return c.redirect(joinUrl(requireBlogSettingsSection('siteIdentity').website, '/images/open-graph.png'))
}

// ─── Avatar ───────────────────────────────────────────────────────

const AVATAR_HEADERS: HeadersInit = {
  'Cache-Control': 'public, max-age=604800',
}

// ─── Router ───────────────────────────────────────────────────────

export const imagesRouter = new Hono<Env>()
  .get('/images/og/:slug.png', async (c) => {
    const slug = c.req.param('slug')
    if (!slug) {
      return ogFallback(c)
    }

    const ttl = requireBlogSettingsSection('cache').cache.og.ttlSeconds
    const entry = await getEntryBySlug(slug)
    if (entry === null) {
      return ogFallback(c)
    }

    if (entry.type === 'post') {
      const post = await findPostBySlug(slug)
      if (!post) {
        return ogFallback(c)
      }
      const buffer = await loadBuffer(
        ogCacheKey(slug, post.title, post.summary, post.cover),
        () => drawOpenGraph({ title: post.title, summary: post.summary, cover: post.cover }),
        ttl,
      )
      c.header('Content-Type', 'image/png')
      Object.entries(OG_HEADERS).forEach(([k, v]) => c.header(k, v))
      return c.body(new Uint8Array(buffer))
    }

    const page = await findPageBySlug(slug)
    if (!page) {
      return ogFallback(c)
    }
    const summary = page.summary || requireBlogSettingsSection('siteIdentity').description
    const buffer = await loadBuffer(
      ogCacheKey(slug, page.title, summary, page.cover),
      () => drawOpenGraph({ title: page.title, summary, cover: page.cover }),
      ttl,
    )
    c.header('Content-Type', 'image/png')
    Object.entries(OG_HEADERS).forEach(([k, v]) => c.header(k, v))
    return c.body(new Uint8Array(buffer))
  })
  .get('/images/calendar/:year/:time.png', async (c) => {
    const params = c.req.param()
    const headers = { 'Cache-Control': 'public, max-age=86400' }
    const res = await serveCalendar(params, 'light', headers)
    res.headers.forEach((v, k) => c.header(k, v))
    return c.body(await res.arrayBuffer())
  })
  .get('/images/calendar/dark/:year/:time.png', async (c) => {
    const params = c.req.param()
    const headers = { 'Cache-Control': 'public, max-age=86400' }
    const res = await serveCalendar(params, 'dark', headers)
    res.headers.forEach((v, k) => c.header(k, v))
    return c.body(await res.arrayBuffer())
  })
  .get('/images/avatar/:hash.png', async (c) => {
    const hash = c.req.param('hash')
    if (!hash) {
      return c.redirect(defaultAvatarUrl())
    }

    const { email, hash: canonical } = await resolveAvatarInfo(hash)
    if (canonical === null) {
      await cacheAvatar({ email: hash, status: AvatarStatus.NO_AVATAR })
      return c.redirect(defaultAvatarUrl())
    }

    if (email && isQQEmail(email)) {
      const buffer = await fetchQQAvatarImage(email)
      if (buffer === null) {
        await cacheAvatar({ email: canonical, status: AvatarStatus.NO_AVATAR })
        return c.redirect(defaultAvatarUrl())
      }
      await cacheAvatar({ email: canonical, status: AvatarStatus.HAVE_AVATAR, buffer })
      c.header('Content-Type', 'image/png')
      Object.entries(AVATAR_HEADERS).forEach(([k, v]) => c.header(k, v))
      return c.body(new Uint8Array(buffer))
    }

    const avatar = await loadAvatar(canonical)
    if (avatar !== null) {
      if (avatar.status === AvatarStatus.NO_AVATAR) {
        return c.redirect(defaultAvatarUrl())
      }
      if (avatar.buffer !== null) {
        c.header('Content-Type', 'image/png')
        Object.entries(AVATAR_HEADERS).forEach(([k, v]) => c.header(k, v))
        return c.body(new Uint8Array(avatar.buffer))
      }
    }

    const buffer = await fetchAvatarImage(canonical)
    if (buffer === null) {
      await cacheAvatar({ email: canonical, status: AvatarStatus.NO_AVATAR })
      return c.redirect(defaultAvatarUrl())
    }

    await cacheAvatar({ email: canonical, status: AvatarStatus.HAVE_AVATAR, buffer })
    c.header('Content-Type', 'image/png')
    Object.entries(AVATAR_HEADERS).forEach(([k, v]) => c.header(k, v))
    return c.body(new Uint8Array(buffer))
  })
