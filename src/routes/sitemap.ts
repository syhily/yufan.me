import config from '@/blog.config'
import { joinUrl } from '@/shared/urls'

export async function loader() {
  const { getPages, getPosts } = await import('@/services/catalog/schema')
  const [posts, pages] = await Promise.all([getPosts({ hidden: false, schedule: false }), getPages()])

  const result = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${config.website}/</loc></url>
  ${posts.map((post) => `<url><loc>${joinUrl(config.website, post.permalink)}</loc><lastmod>${post.date.toISOString()}</lastmod></url>`).join('\n')}
  ${pages.map((page) => `<url><loc>${joinUrl(config.website, page.permalink)}</loc><lastmod>${page.date.toISOString()}</lastmod></url>`).join('\n')}
</urlset>
  `.trim()

  return new Response(result, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
