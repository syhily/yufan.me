import { joinPaths } from '@astrojs/internal-helpers/path'

import { getPages, getPosts } from '@/services/catalog/schema'

export async function GET() {
  const [posts, pages] = await Promise.all([getPosts({ hidden: false, schedule: false }), getPages()])

  const result = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${import.meta.env.SITE}/</loc></url>
  ${posts
    .map((post) => {
      return `<url><loc>${joinPaths(import.meta.env.SITE, post.permalink)}</loc><lastmod>${post.date.toISOString()}</lastmod></url>`
    })
    .join('\n')}
    ${pages
      .map((page) => {
        return `<url><loc>${joinPaths(import.meta.env.SITE, page.permalink)}</loc><lastmod>${page.date.toISOString()}</lastmod></url>`
      })
      .join('\n')}
</urlset>
  `.trim()

  return new Response(result, {
    headers: {
      Host: import.meta.env.SITE,
      'Content-Type': 'application/xml',
      Accept: '*/*',
      Connection: 'keep-alive',
    },
  })
}
