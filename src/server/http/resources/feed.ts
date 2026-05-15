import { Hono } from 'hono'

import type { Env } from '@/server/http/context'

import { feedResponse } from '@/server/feed'
import { getSlug, scopeFromUrl } from '@/server/feed/scope'

export const feedRouter = new Hono<Env>()
  .get('/feed', (c) => feedResponse('rss', scopeFromUrl(c.req.url, getSlug({}))))
  .get('/feed/atom', (c) => feedResponse('atom', scopeFromUrl(c.req.url, getSlug({}))))
  .get('/cats/:slug/feed', (c) => feedResponse('rss', scopeFromUrl(c.req.url, getSlug(c.req.param()))))
  .get('/cats/:slug/feed/atom', (c) => feedResponse('atom', scopeFromUrl(c.req.url, getSlug(c.req.param()))))
  .get('/tags/:slug/feed', (c) => feedResponse('rss', scopeFromUrl(c.req.url, getSlug(c.req.param()))))
  .get('/tags/:slug/feed/atom', (c) => feedResponse('atom', scopeFromUrl(c.req.url, getSlug(c.req.param()))))
