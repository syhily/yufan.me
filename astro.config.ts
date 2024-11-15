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
import uploader from 'astro-uploader'
import { defineConfig, envField } from 'astro/config'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeMathjax from 'rehype-mathjax'
import rehypeSlug from 'rehype-slug'
import remarkMath from 'remark-math'
import { loadEnv } from 'vite'
import vitePluginBinary from 'vite-plugin-binary'
import Font from 'vite-plugin-font'
import options from './options'
import { astroImage, rootImages } from './plugins/images'

const {
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
    staticImportMetaEnv: true,
  },
  image: {
    domains: ['localhost', '127.0.0.1'],
    service: !options.isProd()
      ? { entrypoint: './plugins/resize', config: {} }
      : undefined,
  },
  session: {
    driver: 'memory',
    ttl: 60 * 60,
    cookie: {
      name: 'yufan-me-session',
      sameSite: 'strict',
      secure: true,
    },
  },
  env: {
    schema: {
      // SMTP Service
      SMTP_HOST: envField.string({ context: 'server', access: 'secret', optional: true }),
      SMTP_PORT: envField.number({ context: 'server', access: 'secret', optional: true }),
      SMTP_SECURE: envField.boolean({ context: 'server', access: 'secret', optional: true, default: true }),
      SMTP_USER: envField.string({ context: 'server', access: 'secret', optional: true }),
      SMTP_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
      SMTP_SENDER: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Database Storage Path
      DATABASE_STORAGE_PATH: envField.string({ context: 'server', access: 'secret', default: '/data' }),
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
      enable: UPLOAD_STATIC_FILES === 'true',
      paths: [
        { path: 'images', recursive: true, keep: false, override: false },
        'assets',
      ],
      endpoint: S3_ENDPOINT,
      bucket: S3_BUCKET,
      accessKey: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
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
        'sharp',
      ],
    },
    plugins: [vitePluginBinary({ gzip: true }), Font.vite({ include: [/src\/assets\/fonts\/opposans.ttf/] })],
    assetsInclude: ['images/**/*'],
  },
  build: {
    assets: 'assets',
    assetsPrefix: options.assetsPrefix(),
  },
})
