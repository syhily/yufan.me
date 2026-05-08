import type { Context } from 'hono'

import { Hono } from 'hono'

import { feedResponse } from '@/server/present/feed'
import { getSlug, scopeFromUrl } from '@/server/present/feed/scope'

import type { Env } from '../context'

async function writeFeedResponse(c: Context<Env>, kind: 'rss' | 'atom', scope?: Parameters<typeof feedResponse>[1]) {
  const res = await feedResponse(kind, scope)
  res.headers.forEach((v, k) => c.header(k, v))
  return c.body(await res.text())
}

export const feedRouter = new Hono<Env>()
  .get('/feed', async (c) => writeFeedResponse(c, 'rss', scopeFromUrl(c.req.url, undefined)))
  .get('/feed/atom', async (c) => writeFeedResponse(c, 'atom', scopeFromUrl(c.req.url, undefined)))
  .get('/cats/:slug/feed', async (c) =>
    writeFeedResponse(c, 'rss', scopeFromUrl(c.req.url, getSlug({ slug: c.req.param('slug') }))),
  )
  .get('/cats/:slug/feed/atom', async (c) =>
    writeFeedResponse(c, 'atom', scopeFromUrl(c.req.url, getSlug({ slug: c.req.param('slug') }))),
  )
  .get('/tags/:slug/feed', async (c) =>
    writeFeedResponse(c, 'rss', scopeFromUrl(c.req.url, getSlug({ slug: c.req.param('slug') }))),
  )
  .get('/tags/:slug/feed/atom', async (c) =>
    writeFeedResponse(c, 'atom', scopeFromUrl(c.req.url, getSlug({ slug: c.req.param('slug') }))),
  )
