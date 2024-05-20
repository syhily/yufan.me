import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import compress from '@playform/compress';
import zeabur from '@zeabur/astro-adapter/serverless';
import type { AstroIntegration } from 'astro';
import { defineConfig } from 'astro/config';

const site = import.meta.env.PROD ? 'https://yufan.me' : 'http://localhost:4321';

// https://astro.build/config
export default defineConfig({
  site: site,
  adapter: zeabur(),
  output: 'hybrid',
  integrations: [
    sitemap(),
    mdx(),
    // Remove the following type gymnastics when the following issue is fixed.
    // https://github.com/PlayForm/Compress/issues/329
    compress({
      CSS: true,
      Image: true,
      HTML: true,
      JavaScript: true,
      SVG: true,
    }) as unknown as AstroIntegration,
  ],
});
