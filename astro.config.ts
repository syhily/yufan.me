import process from 'node:process'
import mdx from '@astrojs/mdx'
import node from '@astrojs/node'
import rehypeMathML from '@daiji256/rehype-mathml'
import {
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from '@shikijs/transformers'
import { defineConfig, envField } from 'astro/config'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeSlug from 'rehype-slug'
import rehypeTitleFigure from 'rehype-title-figure'
import remarkMath from 'remark-math'
import { loadEnv } from 'vite'
import vitePluginBinary from 'vite-plugin-binary'
import config from './src/blog.config'
import uploader from './src/helpers/assetry'

const {
  REDIS_URL,
  NODE_ENV,
  ASSETRY_API_KEY,
} = loadEnv(process.env.NODE_ENV!, process.cwd(), '')

// https://astro.build/config
export default defineConfig({
  site: NODE_ENV === 'production' ? 'https://yufan.me' : 'http://localhost:4321',
  output: 'server',
  security: {
    checkOrigin: true,
  },
  experimental: {
    preserveScriptOrder: true,
    staticImportMetaEnv: true,
  },
  trailingSlash: 'never',
  image: {
    domains: [config.settings.asset.host],
    service: { entrypoint: './src/helpers/content/assetry' },
  },
  session: {
    driver: 'redis',
    ttl: 60 * 60,
    options: {
      url: REDIS_URL,
    },
    cookie: {
      name: 'yufan-me-session',
      sameSite: 'lax',
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
      // Database
      DATABASE_URL: envField.string({ context: 'server', access: 'secret', url: true }),
      REDIS_URL: envField.string({ context: 'server', access: 'secret', url: true }),
      ASSETRY_API_KEY: envField.string({ context: 'server', access: 'secret' }),
    },
    validateSecrets: true,
  },
  integrations: [
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        [rehypeTitleFigure],
        [rehypeExternalLinks, { rel: 'nofollow', target: '_blank' }],
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: 'append', properties: {} }],
        rehypeMathML,
      ],
    }),
    uploader({
      apiKey: ASSETRY_API_KEY,
      paths: ['assets'],
      endpoint: `${config.settings.asset.scheme}://${config.settings.asset.host}`,
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
        transformerNotationDiff({
          matchAlgorithm: 'v3',
        }),
        transformerNotationHighlight({
          matchAlgorithm: 'v3',
        }),
        transformerNotationWordHighlight({
          matchAlgorithm: 'v3',
        }),
        transformerNotationFocus({
          matchAlgorithm: 'v3',
        }),
        transformerNotationErrorLevel({
          matchAlgorithm: 'v3',
        }),
      ],
    },
  },
  server: {
    port: 4321,
  },
  devToolbar: {
    enabled: false,
  },
  vite: {
    optimizeDeps: {
      exclude: [
        '@napi-rs/canvas',
        'sharp',
      ],
    },
    plugins: [
      vitePluginBinary({ gzip: true }),
    ],
    build: {
      emptyOutDir: true,
    },
  },
  build: {
    assets: 'assets',
    assetsPrefix: `${config.settings.asset.scheme}://${config.settings.asset.host}`,
  },
})
