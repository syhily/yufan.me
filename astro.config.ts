import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import robots from 'astro-robots-txt';
import { defineConfig } from 'astro/config';
const site = import.meta.env.PROD ? 'https://blog.yufan.me' : 'http://localhost:4321';

// https://astro.build/config
export default defineConfig({
  site: site,
  output: 'hybrid',
  integrations: [sitemap(), robots({ sitemap: `${site}/sitemap-index.xml` }), mdx()],
  adapter: node({
    mode: 'standalone',
  }),
  markdown: {
    shikiConfig: {
      theme: 'solarized-light',
      wrap: false,
    },
  },
});
