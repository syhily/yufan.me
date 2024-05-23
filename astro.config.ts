import mdx from '@astrojs/mdx';
import zeabur from '@zeabur/astro-adapter/serverless';
import robots from 'astro-robots-txt';
import { defineConfig } from 'astro/config';

// Dynamic switch the site.
const site = import.meta.env.PROD ? 'https://yufan.me' : 'http://localhost:4321';

// https://astro.build/config
export default defineConfig({
  site: site,
  output: 'server',
  integrations: [robots({ sitemap: `${site}/sitemap.xml` }), mdx()],
  adapter: zeabur(),
  markdown: {
    gfm: true,
    shikiConfig: {
      theme: 'solarized-light',
      wrap: false,
    },
  },
});
