import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import compress from '@playform/compress';
import { defineConfig } from 'astro/config';
import arraybuffer from 'vite-plugin-arraybuffer';

// Dynamic switch the site. This is hard coded.
const port = 4321;
const site = import.meta.env.PROD ? 'https://yufan.me' : `http://localhost:${port}`;

// https://astro.build/config
export default defineConfig({
  site: site,
  output: 'server',
  security: {
    checkOrigin: true,
  },
  integrations: [
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
  server: {
    host: true,
    port: port,
  },
  devToolbar: {
    // I don't need such toolbar.
    enabled: false,
  },
  vite: {
    plugins: [arraybuffer()],
    // Add this for avoiding the needless import optimize in Vite.
    optimizeDeps: { exclude: ['@napi-rs/canvas'] },
  },
});
