import { pages, posts } from '@/helpers/schema';
import { urlJoin } from '@/helpers/tools';

export const prerender = true;

export async function GET() {
  const result = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${import.meta.env.SITE}/</loc></url>
  ${posts
    .map((post) => {
      return `<url><loc>${urlJoin(import.meta.env.SITE, post.permalink)}</loc><lastmod>${post.date.toISOString()}</lastmod></url>`;
    })
    .join('\n')}
    ${pages
      .map((page) => {
        return `<url><loc>${urlJoin(import.meta.env.SITE, page.permalink)}</loc><lastmod>${page.date.toISOString()}</lastmod></url>`;
      })
      .join('\n')}
</urlset>
  `.trim();

  return new Response(result, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
