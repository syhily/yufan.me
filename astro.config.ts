import mdx from '@astrojs/mdx'
import node from '@astrojs/node'
import react from '@astrojs/react'
import uploader from 'astro-uploader'
import { defineConfig, envField, memoryCache, sessionDrivers } from 'astro/config'
import process from 'node:process'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeMathjax from 'rehype-mathjax'
import rehypeSlug from 'rehype-slug'
import rehypeTitleFigure from 'rehype-title-figure'
import remarkMath from 'remark-math'
import { loadEnv } from 'vite'
import vitePluginBinary from 'vite-plugin-binary'

import config from './src/blog.config'
import catalogDevHmr from './src/services/catalog/dev-hmr'
import rehypeMermaid from './src/services/markdown/mermaid'
import { SHIKI_THEME, shikiTransformers } from './src/services/markdown/shiki'

const { REDIS_URL, NODE_ENV, S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_ACCESS_KEY } = loadEnv(
  process.env.NODE_ENV!,
  process.cwd(),
  '',
)

// https://astro.build/config
export default defineConfig({
  base: '/',
  site: NODE_ENV === 'production' ? config.website : 'http://localhost:4321',
  output: 'server',
  security: {
    checkOrigin: true,
    allowedDomains:
      NODE_ENV === 'production'
        ? [
            {
              hostname: `**.${config.website}`,
              protocol: 'https',
              port: '443',
            },
            {
              hostname: config.website,
              protocol: 'https',
              port: '443',
            },
          ]
        : [{}],
    actionBodySizeLimit: 16 * 1024 * 1024,
  },
  experimental: {
    cache: { provider: memoryCache() },
    rustCompiler: true,
    queuedRendering: {
      enabled: true,
    },
  },
  trailingSlash: 'ignore',
  // Static redirects for routes whose only purpose was to bounce to "/".
  // Previously each one was its own .astro file with `Astro.redirect('/')` in
  // the frontmatter; collecting them here means Astro can serve a 301 from
  // the edge instead of spinning up SSR.
  redirects: {
    '/page': '/',
    '/posts': '/',
    '/cats': '/',
    '/cats/[slug]/page': '/',
    '/tags/[slug]/page': '/',
  },
  image: {
    domains: [config.settings.asset.host],
    service: { entrypoint: './src/services/images/service' },
  },
  session: {
    driver: sessionDrivers.redis({
      url: REDIS_URL,
    }),
  },
  env: {
    schema: {
      // SMTP Service
      ZEABUR_MAIL_HOST: envField.string({ context: 'server', access: 'secret', optional: true }),
      ZEABUR_MAIL_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      ZEABUR_MAIL_SENDER: envField.string({ context: 'server', access: 'secret', optional: true }),
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
        [
          rehypeMermaid,
          {
            strategy: 'inline-svg',
            theme: 'solarized-light',
            renderOptions: { transparent: true },
          },
        ],
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
    // React powers the entire view layer (layouts, partials, listings, post detail,
    // admin, MDX wrappers) after the Astro → TSX migration. Templates are authored as
    // async server components and render to static HTML by default — Astro only ships
    // a client runtime when a component is tagged with a `client:*` directive.
    react(),
    catalogDevHmr(),
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
      theme: SHIKI_THEME,
      wrap: false,
      transformers: shikiTransformers(),
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
    plugins: [vitePluginBinary({ gzip: true })],
    build: {
      emptyOutDir: true,
    },
  },
  build: {
    assets: 'assets',
    assetsPrefix: `${config.settings.asset.scheme}://${config.settings.asset.host}`,
  },
})
