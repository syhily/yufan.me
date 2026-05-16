import { Hono } from 'hono'

import type { Env } from '@/server/http/context'

import { buildSitemapXml } from '@/server/present/seo/sitemap'

export const sitemapRouter = new Hono<Env>().get('/sitemap.xml', async (c) => {
  const xml = await buildSitemapXml(c.req.raw)
  c.header('Content-Type', 'application/xml; charset=utf-8')
  c.header('Cache-Control', 'public, max-age=3600')
  return c.body(xml)
})
