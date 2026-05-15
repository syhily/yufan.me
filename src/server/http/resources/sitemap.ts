import { Hono } from 'hono'

import type { Env } from '@/server/http/context'

import { buildSitemapXml } from '@/server/seo/sitemap'

export const sitemapRouter = new Hono<Env>().get('/sitemap.xml', async (c) => {
  const xml = await buildSitemapXml(c.req.raw)
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})
