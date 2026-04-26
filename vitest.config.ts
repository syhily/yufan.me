import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite-plus'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// Standalone Vitest config — intentionally NOT loading the React Router or
// fumadocs-mdx Vite plugins. Tests target unit-level code paths
// (`server/markdown/parser`, `server/catalog` invariants) that don't need
// the full SSR plugin chain, and the plugins fail to bootstrap outside a
// running dev server.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
      '~': path.resolve(rootDir, 'public'),
      '#source': path.resolve(rootDir, '.source'),
    },
  },
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
})
