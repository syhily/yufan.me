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
import uploader from 'astro-uploader'
import { defineConfig, envField } from 'astro/config'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeSlug from 'rehype-slug'
import remarkMath from 'remark-math'
import { loadEnv } from 'vite'
import vitePluginBinary from 'vite-plugin-binary'
import Font from 'vite-plugin-font'
import config from './src/blog.config.js'
import rehypeMusicPlayer from './src/components/mdx/netease/rehype.js'

const {
  UPLOAD_STATIC_FILES,
  S3_ENDPOINT,
  S3_BUCKET,
  S3_ACCESS_KEY,
  S3_SECRET_ACCESS_KEY,
  NODE_ENV,
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
    domains: [config.settings.asset.host, 'localhost', '127.0.0.1'],
    service: NODE_ENV !== 'production'
      ? { entrypoint: './src/helpers/content/image/sharp' }
      : { entrypoint: './src/helpers/content/image/qiniu' },
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
      // Database
      DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
    },
    validateSecrets: true,
  },
  integrations: [
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        [rehypeExternalLinks, { rel: 'nofollow', target: '_blank' }],
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: 'append', properties: {} }],
        rehypeMathML,
        rehypeMusicPlayer,
      ],
    }),
    uploader({
      enable: UPLOAD_STATIC_FILES === 'true',
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
    plugins: [vitePluginBinary({ gzip: true }), Font.vite({ include: [/src\/assets\/fonts\/opposans.ttf/] })],
    assetsInclude: ['images/**/*'],
  },
  build: {
    assets: 'assets',
    assetsPrefix: `${config.settings.asset.scheme}://${config.settings.asset.host}`,
  },
})
