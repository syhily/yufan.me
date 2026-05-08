import { listAllPages, listAllPosts } from '@/server/catalog'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { joinUrl } from '@/shared/urls'

import type { Route } from './+types/sitemap'

export function headers() {
  return {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  }
}

export async function loader(_: Route.LoaderArgs) {
  const posts = await listAllPosts({ includeHidden: true, includeScheduled: false })
  const pages = await listAllPages()

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

  return new Response(lines.join('\n'), { headers: headers() })
}
