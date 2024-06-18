import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import { defineConfig, envField } from 'astro/config';
import options from './options';
import { astroImage } from './plugins/images';

// https://astro.build/config
export default defineConfig({
  site: import.meta.env.PROD ? options.website : options.local.website,
  output: 'server',
  security: {
    checkOrigin: true,
  },
  experimental: {
    env: {
      schema: {
        // Postgres Database
        POSTGRES_HOST: envField.string({ context: 'server', access: 'secret' }),
        POSTGRES_PORT: envField.number({ context: 'server', access: 'secret' }),
        POSTGRES_USERNAME: envField.string({ context: 'server', access: 'secret' }),
        POSTGRES_PASSWORD: envField.string({ context: 'server', access: 'secret' }),
        POSTGRES_DATABASE: envField.string({ context: 'server', access: 'secret' }),
        // Artalk Comment
        ARTALK_HOST: envField.string({ context: 'server', access: 'secret' }),
        // UPYUN Integration
        UPYUN_BUCKET: envField.string({ context: 'server', access: 'secret' }),
        UPYUN_OPERATOR: envField.string({ context: 'server', access: 'secret' }),
        UPYUN_PASSWORD: envField.string({ context: 'server', access: 'secret' }),
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
    port: options.local.port,
  },
  devToolbar: {
    // I don't need such toolbar.
    enabled: false,
  },
  vite: {
    // Add this for avoiding the needless import optimize in Vite.
    optimizeDeps: { exclude: ['@napi-rs/canvas'] },
  },
  build: {
    assets: 'cats',
    assetsPrefix: import.meta.env.PROD ? options.settings.assetPrefix : options.local.website,
  },
});
