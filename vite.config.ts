import { reactRouter } from '@react-router/dev/vite'
import mdx from 'fumadocs-mdx/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vitePluginBinary from 'vite-plugin-binary'

import sourceConfig, { categories, friends, pages, posts, tags } from './source.config'
import blogConfig from './src/blog.config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

function normalizeBaseUrl(value: string | undefined): string {
  if (!value || value.trim() === '') {
    return '/'
  }
  const base = value.trim()
  return base.endsWith('/') ? base : `${base}/`
}

export default defineConfig(async ({ command, mode }) => {
  const env = loadEnv(mode, rootDir, '')
  const assetBaseUrl = command === 'build' ? normalizeBaseUrl(env.ASSET_BASE_URL) : '/'
  const site = env.SITE?.trim() || blogConfig.website

  return {
    base: assetBaseUrl,
    define: {
      'import.meta.env.SITE': JSON.stringify(site),
    },
    plugins: [
      await mdx({ default: sourceConfig, categories, friends, pages, posts, tags }),
      reactRouter(),
      vitePluginBinary({ gzip: true }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src'),
        '~': path.resolve(rootDir, 'public'),
      },
    },
    build: {
      emptyOutDir: true,
    },
    server: {
      port: 4321,
    },
  }
})
