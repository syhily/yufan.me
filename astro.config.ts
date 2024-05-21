import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import zeabur from '@zeabur/astro-adapter/serverless';
import type { AstroIntegration } from 'astro';
import { defineConfig } from 'astro/config';

const site = import.meta.env.PROD ? 'https://yufan.me' : 'http://localhost:4321';

// https://astro.build/config
export default defineConfig({
  site: site,
  adapter: zeabur(),
  output: 'server',
  integrations: [sitemap(), mdx()],
});
