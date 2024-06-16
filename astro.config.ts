import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import { defineConfig, envField } from 'astro/config';
import arraybuffer from 'vite-plugin-arraybuffer';
import { astroImage } from './remark-plugins/images';

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
  experimental: {
    env: {
      schema: {
        POSTGRES_HOST: envField.string({ context: 'server', access: 'secret' }),
        POSTGRES_PORT: envField.number({ context: 'server', access: 'secret' }),
        POSTGRES_USERNAME: envField.string({ context: 'server', access: 'secret' }),
        POSTGRES_PASSWORD: envField.string({ context: 'server', access: 'secret' }),
        POSTGRES_DATABASE: envField.string({ context: 'server', access: 'secret' }),
        ARTALK_HOST: envField.string({ context: 'server', access: 'secret' }),
      },
    },
  },
  integrations: [
    mdx({
      remarkPlugins: [astroImage],
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
