import { listAllPages, listAllPosts } from '@/server/catalog'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { joinUrl } from '@/shared/urls'

export async function buildSitemapXml(_request: Request): Promise<string> {
  const [posts, pages] = await Promise.all([
    listAllPosts({ includeHidden: true, includeScheduled: false }),
    listAllPages(),
  ])

  // Build via array join so the response starts with `<?xml ... ?>` on the
  // first byte. The previous template-literal version left a leading newline
  // which some validators reject.
  const website = requireBlogSettingsSection('siteIdentity').website
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${website}/</loc></url>`,
  ]
  for (const post of posts) {
    lines.push(
      `  <url><loc>${joinUrl(website, post.permalink)}</loc><lastmod>${post.date.toISOString()}</lastmod></url>`,
    )
  }
  for (const page of pages) {
    lines.push(
      `  <url><loc>${joinUrl(website, page.permalink)}</loc><lastmod>${page.date.toISOString()}</lastmod></url>`,
    )
  }
  lines.push('</urlset>')

  return lines.join('\n')
}
