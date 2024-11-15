import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import {
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from '@shikijs/transformers';
import AstroPWA from '@vite-pwa/astro';
import { uploader } from 'astro-uploader';
import { defineConfig, envField } from 'astro/config';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeMathjax from 'rehype-mathjax';
import rehypeSlug from 'rehype-slug';
import remarkMath from 'remark-math';
import options from './options';
import { astroImage, openGraph, rootImages } from './plugins/images';

// https://astro.build/config
export default defineConfig({
  // This will override the import.meta.env.SITE. No need to introduce method.
  site: options.isProd() ? options.website : options.local.website,
  output: 'server',
  security: {
    checkOrigin: true,
  },
  image: {
    domains: ['localhost', '127.0.0.1'],
    service: !options.isProd() ? { entrypoint: './plugins/resize', config: {} } : undefined,
  },
  env: {
    schema: {
      // Postgres Database
      POSTGRES_HOST: envField.string({ context: 'server', access: 'secret' }),
      POSTGRES_PORT: envField.number({ context: 'server', access: 'secret' }),
      POSTGRES_USERNAME: envField.string({ context: 'server', access: 'secret' }),
      POSTGRES_PASSWORD: envField.string({ context: 'server', access: 'secret' }),
      POSTGRES_DATABASE: envField.string({ context: 'server', access: 'secret' }),
      // Artalk Comment
      ARTALK_SCHEME: envField.string({ context: 'server', access: 'secret' }),
      ARTALK_HOST: envField.string({ context: 'server', access: 'secret' }),
      ARTALK_PORT: envField.number({ context: 'server', access: 'secret' }),
      // Build the Open Graph
      BUILD_OPEN_GRAPH: envField.boolean({ context: 'server', access: 'public', default: true }),
      // Upload the files
      UPLOAD_STATIC_FILES: envField.boolean({ context: 'server', access: 'public', default: false }),
    },
    validateSecrets: true,
  },
  integrations: [
    rootImages(),
    AstroPWA(),
    mdx({
      remarkPlugins: [astroImage, remarkMath],
      rehypePlugins: [
        [rehypeExternalLinks, { rel: 'nofollow', target: '_blank' }],
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: 'append', properties: {} }],
        rehypeMathjax,
      ],
    }),
    uploader({
      enable:
        process.env.BUILD_OPEN_GRAPH === undefined ||
        process.env.BUILD_OPEN_GRAPH === 'true' ||
        process.env.UPLOAD_STATIC_FILES === 'true',
      paths: [{ path: 'images', recursive: true, keep: false, override: false }, 'assets'],
      recursive: true,
      keep: false,
      endpoint: process.env.S3_ENDPOINT,
      bucket: process.env.S3_BUCKET as string,
      accessKey: process.env.S3_ACCESS_KEY as string,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
    }),
    openGraph(),
  ],
  adapter: node({
    mode: 'standalone',
  }),
  markdown: {
    gfm: true,
    shikiConfig: {
      theme: 'solarized-light',
      wrap: false,
      transformers: [
        transformerNotationDiff(),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationFocus(),
        transformerNotationErrorLevel(),
      ],
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
    optimizeDeps: { exclude: ['@napi-rs/canvas', 'opendal', 'sharp'] },
    assetsInclude: ['images/**/*'],
  },
  build: {
    assets: 'assets',
    assetsPrefix: options.assetsPrefix(),
  },
});
