import { Hono } from 'hono'

import { feedResponse } from '@/server/feed'
import { getSlug, scopeFromUrl } from '@/server/feed/scope'

import type { Env } from '../context'

export const feedRouter = new Hono<Env>()
  .get('/feed', async (c) => {
    return feedResponse('rss', scopeFromUrl(c.req.url, undefined))
  })
  .get('/feed/atom', async (c) => {
    return feedResponse('atom', scopeFromUrl(c.req.url, undefined))
  })
  .get('/cats/:slug/feed', async (c) => {
    return feedResponse('rss', scopeFromUrl(c.req.url, getSlug({ slug: c.req.param('slug') })))
  })
  .get('/cats/:slug/feed/atom', async (c) => {
    return feedResponse('atom', scopeFromUrl(c.req.url, getSlug({ slug: c.req.param('slug') })))
  })
  .get('/tags/:slug/feed', async (c) => {
    return feedResponse('rss', scopeFromUrl(c.req.url, getSlug({ slug: c.req.param('slug') })))
  })
  .get('/tags/:slug/feed/atom', async (c) => {
    return feedResponse('atom', scopeFromUrl(c.req.url, getSlug({ slug: c.req.param('slug') })))
  })
