import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import compress from '@playform/compress';
import robots from 'astro-robots-txt';
import { defineConfig } from 'astro/config';

// Dynamic switch the site.
const site = import.meta.env.PROD ? 'https://yufan.me' : 'http://localhost:4321';

// https://astro.build/config
export default defineConfig({
  site: site,
  output: 'server',
  integrations: [
    robots({ sitemap: `${site}/sitemap.xml` }),
    mdx(),
    compress({
      CSS: false,
      HTML: false,
      Image: true,
      JavaScript: true,
      SVG: true,
    }),
  ],
  adapter: node({
    mode: 'standalone',
  }),
  markdown: {
    gfm: true,
    shikiConfig: {
      theme: 'solarized-light',
      wrap: false,
    },
  },
});
