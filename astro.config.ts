import process from 'node:process'
import mdx from '@astrojs/mdx'
import node from '@astrojs/node'
import {
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from '@shikijs/transformers'
import { uploader } from 'astro-uploader'
import { defineConfig, envField } from 'astro/config'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeMathjax from 'rehype-mathjax'
import rehypeSlug from 'rehype-slug'
import remarkMath from 'remark-math'
import { loadEnv } from 'vite'
import options from './options'
import { astroImage, openGraph, rootImages } from './plugins/images'

const {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASSWORD,
  BUILD_OPEN_GRAPH,
  UPLOAD_STATIC_FILES,
  S3_ENDPOINT,
  S3_BUCKET,
  S3_ACCESS_KEY,
  S3_SECRET_ACCESS_KEY,
} = loadEnv(process.env.NODE_ENV!, process.cwd(), '')

// https://astro.build/config
export default defineConfig({
  // This will override the import.meta.env.SITE. No need to introduce method.
  site: options.isProd() ? options.website : options.local.website,
  output: 'server',
  security: {
    checkOrigin: true,
  },
  experimental: {
    preserveScriptOrder: true,
  },
  image: {
    domains: ['localhost', '127.0.0.1'],
    service: !options.isProd()
      ? { entrypoint: './plugins/resize', config: {} }
      : undefined,
  },
  session: {
    driver: 'redis',
    options: {
      host: REDIS_HOST,
      tls: false as any,
      port: Number(REDIS_PORT),
      password: REDIS_PASSWORD,
    },
    ttl: 60 * 60,
    cookie: {
      name: 'yufan-me-session',
      sameSite: 'strict',
      secure: true,
    },
  },
  env: {
    schema: {
      // PostgreSQL
      POSTGRES_HOST: envField.string({ context: 'server', access: 'secret' }),
      POSTGRES_PORT: envField.number({ context: 'server', access: 'secret' }),
      POSTGRES_USERNAME: envField.string({
        context: 'server',
        access: 'secret',
      }),
      POSTGRES_PASSWORD: envField.string({
        context: 'server',
        access: 'secret',
      }),
      POSTGRES_DATABASE: envField.string({
        context: 'server',
        access: 'secret',
      }),
      // Session Store
      REDIS_HOST: envField.string({ context: 'server', access: 'secret' }),
      REDIS_PORT: envField.number({ context: 'server', access: 'secret' }),
      REDIS_PASSWORD: envField.string({ context: 'server', access: 'secret' }),
      // Static Assets
      BUILD_OPEN_GRAPH: envField.boolean({
        context: 'server',
        access: 'public',
        default: true,
      }),
      UPLOAD_STATIC_FILES: envField.boolean({
        context: 'server',
        access: 'public',
        default: false,
      }),
      S3_ENDPOINT: envField.string({ context: 'server', access: 'secret' }),
      S3_BUCKET: envField.string({ context: 'server', access: 'secret' }),
      S3_ACCESS_KEY: envField.string({ context: 'server', access: 'secret' }),
      S3_SECRET_ACCESS_KEY: envField.string({
        context: 'server',
        access: 'secret',
      }),
    },
    validateSecrets: true,
  },
  integrations: [
    rootImages(),
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
        BUILD_OPEN_GRAPH === undefined
        || BUILD_OPEN_GRAPH === 'true'
        || UPLOAD_STATIC_FILES === 'true',
      paths: [
        { path: 'images', recursive: true, keep: false, override: false },
        'assets',
      ],
      recursive: true,
      keep: false,
      endpoint: S3_ENDPOINT,
      bucket: S3_BUCKET as string,
      accessKey: S3_ACCESS_KEY as string,
      secretAccessKey: S3_SECRET_ACCESS_KEY as string,
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
    optimizeDeps: {
      exclude: [
        '@napi-rs/canvas',
        'opendal',
        'sharp',
      ],
    },
    assetsInclude: ['images/**/*'],
  },
  build: {
    assets: 'assets',
    assetsPrefix: options.assetsPrefix(),
  },
})
