import type { OxfmtConfig } from 'oxfmt'
import type { OxlintConfig } from 'oxlint'
import type { Plugin, PluginOption } from 'vite'

import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import mdx from 'fumadocs-mdx/vite'
import binary from 'vite-plugin-binary'
import { defineConfig } from 'vite-plus'

import oxfmtConfig from './oxfmt.config.ts'
import oxlintConfig from './oxlint.config.ts'
import sourceConfig, { posts } from './source.config.ts'

// Vite+ reads `fmt` / `lint` / `staged` only from a static `defineConfig({...})`
// export (functional / async configs are not supported — see
// https://viteplus.dev/guide/troubleshooting). `mdx()` returns a Promise, so
// we resolve it at the module level via top-level `await`.
const mdxPlugin = await mdx({ default: sourceConfig, posts })

export default defineConfig({
  fmt: oxfmtConfig as OxfmtConfig,
  lint: oxlintConfig as OxlintConfig,
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      // v8 reporter ships with vite-plus/vitest. Keep the report local-only;
      // CI gating is opt-in via `vp test run --coverage`.
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/server/db/schema.ts',
        'src/server/db/types/**',
        'src/env.d.ts',
        'src/blog.config.ts',
        'src/routes.ts',
        'src/entry.client.tsx',
        'src/entry.server.tsx',
        'src/root.tsx',
        // Routes are exercised through route-layer tests; the route module
        // file itself is mostly JSX glue (no logic worth measuring).
        'src/routes/**/*.tsx',
        // Pure asset/script bundles served to the browser; covered through
        // their consumers in `tests/snapshot.components.*`.
        'src/assets/**',
        'src/ui/**',
      ],
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
        statements: 70,
      },
    },
  },
  staged: {
    '*.{js,jsx,ts,tsx,mjs,cjs}': 'vp fmt && vp lint',
  },
  plugins: [
    binary({ gzip: true, excludeAsset: true }),
    mdxPlugin,
    ...(reactRouter() as Plugin[]),
    tailwindcss(),
  ] as PluginOption[],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    emptyOutDir: true,
  },
  server: {
    port: 4321,
  },
})
