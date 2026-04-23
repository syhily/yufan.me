import type { AstroIntegration } from 'astro'
import type { Plugin } from 'vite'

import path from 'node:path'

// Astro integration that resets the in-memory ContentCatalog whenever a
// content collection file changes during `astro dev`. Without this, edits
// to posts/pages/categories/tags/friends only show up after a full
// restart because ContentCatalog memoizes the very first build.
//
// The integration only injects a Vite plugin in dev/serve mode; in build
// mode the catalog is built once and never needs invalidation.
export default function catalogDevHmr(): AstroIntegration {
  const watchedDirs = ['/src/content/']

  function makeVitePlugin(rootDir: string): Plugin {
    const contentRoots = watchedDirs.map((d) => path.resolve(rootDir, `.${d}`))

    return {
      name: 'yufan:catalog-dev-hmr',
      apply: 'serve',
      async handleHotUpdate({ file }) {
        if (!contentRoots.some((root) => file.startsWith(root))) return
        try {
          // Lazy import so the plugin file itself is cheap to load.
          const { ContentCatalog } = await import('@/services/catalog')
          ContentCatalog.reset()
        } catch {
          // Swallow — invalidation is best-effort and shouldn't break HMR.
        }
      },
    }
  }

  return {
    name: 'catalog-dev-hmr',
    hooks: {
      'astro:config:setup': ({ command, config, updateConfig }) => {
        if (command !== 'dev') return
        updateConfig({
          vite: {
            plugins: [makeVitePlugin(config.root.pathname || process.cwd())],
          },
        })
      },
    },
  }
}
