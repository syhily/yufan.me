import { Hono } from 'hono'
import crypto from 'node:crypto'

import type { Env } from '@/server/http/context'

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
import { pngResponse } from '@/server/route-helpers/http'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { joinUrl } from '@/shared/urls'

const OG_PNG_HEADERS: Record<string, string> = {
  'Cache-Control': 'public, max-age=604800, immutable',
}
const AVATAR_PNG_HEADERS: Record<string, string> = {
  'Cache-Control': 'public, max-age=604800',
}

function ogCacheKey(slug: string, title: string, summary: string, cover: string): string {
  const hash = crypto.createHash('sha1').update(`${title}${summary}${cover}`).digest('hex').slice(0, 16)
  return `${requireBlogSettingsSection('cache').cache.og.prefix}${slug}-${hash}`
}

function ogFallback() {
  return new Response(null, {
    status: 302,
    headers: { Location: joinUrl(requireBlogSettingsSection('siteIdentity').website, '/images/open-graph.png') },
  })
}

export const imagesRouter = new Hono<Env>()
  // ── OG image ──────────────────────────────────────────
  .get('/images/og/:slug.png', async (c) => {
    const slug = c.req.param('slug')
    if (!slug) {
      return ogFallback()
    }
    const ttl = requireBlogSettingsSection('cache').cache.og.ttlSeconds
    const entry = await getEntryBySlug(slug)
    if (entry === null) {
      return ogFallback()
    }

    if (entry.type === 'post') {
      const post = await findPostBySlug(slug)
      if (!post) {
        return ogFallback()
      }
      const buffer = await loadBuffer(
        ogCacheKey(slug, post.title, post.summary, post.cover),
        () => drawOpenGraph({ title: post.title, summary: post.summary, cover: post.cover }),
        ttl,
      )
      return pngResponse(buffer, OG_PNG_HEADERS)
    }

    const page = await findPageBySlug(slug)
    if (!page) {
      return ogFallback()
    }
    const summary = page.summary || requireBlogSettingsSection('siteIdentity').description
    const buffer = await loadBuffer(
      ogCacheKey(slug, page.title, summary, page.cover),
      () => drawOpenGraph({ title: page.title, summary, cover: page.cover }),
      ttl,
    )
    return pngResponse(buffer, OG_PNG_HEADERS)
  })

  // ── Calendar ──────────────────────────────────────────
  .get('/images/calendar/:year/:time.png', (c) => {
    return serveCalendar(c.req.param(), 'light', { 'Cache-Control': 'public, max-age=86400' })
  })
  .get('/images/calendar/dark/:year/:time.png', (c) => {
    return serveCalendar(c.req.param(), 'dark', { 'Cache-Control': 'public, max-age=86400' })
  })

  // ── Avatar ────────────────────────────────────────────
  .get('/images/avatar/:hash.png', async (c) => {
    const hash = c.req.param('hash')
    if (!hash) {
      return Response.redirect(defaultAvatarUrl())
    }

    const { email, hash: canonical } = await resolveAvatarInfo(hash)
    if (canonical === null) {
      await cacheAvatar({ email: hash, status: AvatarStatus.NO_AVATAR })
      return Response.redirect(defaultAvatarUrl())
    }

    if (email && isQQEmail(email)) {
      const buffer = await fetchQQAvatarImage(email)
      if (buffer === null) {
        await cacheAvatar({ email: canonical, status: AvatarStatus.NO_AVATAR })
        return Response.redirect(defaultAvatarUrl())
      }
      await cacheAvatar({ email: canonical, status: AvatarStatus.HAVE_AVATAR, buffer })
      return pngResponse(buffer, AVATAR_PNG_HEADERS)
    }

    const avatar = await loadAvatar(canonical)
    if (avatar !== null) {
      if (avatar.status === AvatarStatus.NO_AVATAR) {
        return Response.redirect(defaultAvatarUrl())
      }
      if (avatar.buffer !== null) {
        return pngResponse(avatar.buffer, AVATAR_PNG_HEADERS)
      }
    }

    const buffer = await fetchAvatarImage(canonical)
    if (buffer === null) {
      await cacheAvatar({ email: canonical, status: AvatarStatus.NO_AVATAR })
      return Response.redirect(defaultAvatarUrl())
    }
    await cacheAvatar({ email: canonical, status: AvatarStatus.HAVE_AVATAR, buffer })
    return pngResponse(buffer, AVATAR_PNG_HEADERS)
  })
