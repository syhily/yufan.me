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
import rehypeTitleFigure from 'rehype-title-figure'
import remarkMath from 'remark-math'
import { loadEnv } from 'vite'
import vitePluginBinary from 'vite-plugin-binary'
import config from './src/blog.config'
import rehypeMermaid from './src/helpers/content/mermaid'

const {
  REDIS_URL,
  NODE_ENV,
  S3_ENDPOINT,
  S3_BUCKET,
  S3_ACCESS_KEY,
  S3_SECRET_ACCESS_KEY,
} = loadEnv(process.env.NODE_ENV!, process.cwd(), '')

// https://astro.build/config
export default defineConfig({
  site: NODE_ENV === 'production' ? 'https://yufan.me' : 'http://localhost:4321',
  output: 'server',
  security: {
    checkOrigin: false,
    actionBodySizeLimit: 16 * 1024 * 1024,
  },
  experimental: {
    preserveScriptOrder: true,
    staticImportMetaEnv: true,
  },
  trailingSlash: 'ignore',
  image: {
    domains: [config.settings.asset.host],
    service: { entrypoint: './src/helpers/images/service' },
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
      MAILGUN_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      MAILGUN_DOMAIN: envField.string({ context: 'server', access: 'secret', optional: true }),
      MAILGUN_SENDER: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Database
      DATABASE_URL: envField.string({ context: 'server', access: 'secret', url: true }),
      REDIS_URL: envField.string({ context: 'server', access: 'secret', url: true }),
    },
    validateSecrets: true,
  },
  integrations: [
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        [rehypeMermaid, {
          strategy: 'inline-svg',
          theme: 'solarized-light',
          renderOptions: { transparent: true },
        }],
        [rehypeTitleFigure],
        [rehypeExternalLinks, { rel: 'nofollow', target: '_blank' }],
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: 'append', properties: {} }],
        [rehypeMathjax, { svg: { fontCache: 'none' } }],
      ],
    }),
    uploader({
      enable: true,
      paths: ['assets'],
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
    syntaxHighlight: {
      type: 'shiki',
      excludeLangs: ['math', 'mermaid'],
    },
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
    remarkRehype: {
      footnoteLabelTagName: 'h2',
      footnoteLabelProperties: { className: ['footnotes'] },
      footnoteLabel: '尾声札记',
      footnoteBackContent: '↩️',
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
