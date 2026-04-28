import type { Plugin } from 'vite'

import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import mdx from 'fumadocs-mdx/vite'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite-plus'

import sourceConfig, { categories, friends, pages, posts, tags } from './source.config.ts'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const toolIgnorePatterns = [
  '**/*.mdx',
  '**/*.md',
  'node_modules',
  'public',
  'build',
  'dist',
  '.react-router',
  '.source',
  '.vite',
  '.cache',
  '.agents',
  '.claude',
  'coverage',
]

// Vite+ reads `fmt` / `lint` / `staged` only from a static `defineConfig({...})`
// export (functional / async configs are not supported — see
// https://viteplus.dev/guide/troubleshooting). `mdx()` returns a Promise, so
// we resolve it at the module level via top-level `await`.
const mdxPlugin = await mdx({ default: sourceConfig, categories, friends, pages, posts, tags })

// `@napi-rs/canvas` reads font bytes off disk at request time (OG / calendar
// image generation), but the SSR bundle never imports the `.ttf` files via
// JS — they're picked up by `font-assets.server.ts`'s `readFileSync`. So we
// need the SSR build to ship the same files alongside `index.js`. Going
// through the rollup `emitFile` API keeps the assets inside Vite's asset
// graph (vs. the prior `copyFileSync` in `closeBundle`, which side-stepped
// hashing and the manifest).
function ssrFontAssets(): Plugin {
  const fonts = [
    {
      sourcePath: path.resolve(rootDir, 'src/assets/fonts/oppo/opposans.ttf'),
      bundlePath: 'assets/opposans.ttf',
    },
    {
      sourcePath: path.resolve(rootDir, 'src/assets/fonts/oppo/opposerif.ttf'),
      bundlePath: 'assets/opposerif.ttf',
    },
  ]
  return {
    name: 'ssr-font-assets',
    apply: 'build',
    applyToEnvironment(env) {
      // Only the SSR environment uses these fonts; the client bundle already
      // has the public CDN-loaded `*.css` from `public/fonts/`.
      return env.name === 'ssr'
    },
    async generateBundle() {
      for (const font of fonts) {
        this.emitFile({
          type: 'asset',
          fileName: font.bundlePath,
          source: await readFile(font.sourcePath),
        })
      }
    },
  }
}

export default defineConfig({
  fmt: {
    arrowParens: 'always',
    bracketSameLine: false,
    bracketSpacing: true,
    endOfLine: 'lf',
    insertFinalNewline: true,
    jsxSingleQuote: false,
    objectWrap: 'preserve',
    printWidth: 120,
    quoteProps: 'as-needed',
    tabWidth: 2,
    useTabs: false,
    singleQuote: true,
    semi: false,
    trailingComma: 'all',
    ignorePatterns: toolIgnorePatterns,
    sortPackageJson: {
      sortScripts: true,
    },
    sortImports: {
      groups: [
        'type-import',
        ['value-builtin', 'value-external'],
        'type-internal',
        'value-internal',
        ['type-parent', 'type-sibling', 'type-index'],
        ['value-parent', 'value-sibling', 'value-index'],
        'unknown',
      ],
    },
  },
  lint: {
    plugins: ['react', 'jsx-a11y', 'react-perf', 'import', 'typescript', 'promise', 'node', 'unicorn', 'oxc'],
    ignorePatterns: toolIgnorePatterns,
    env: {
      browser: true,
      node: true,
      es2022: true,
    },
    settings: {
      react: {
        version: '19.2.5',
        formComponents: [{ name: 'Form', attribute: 'action' }],
        linkComponents: [
          { name: 'Link', attribute: 'to' },
          { name: 'NavLink', attribute: 'to' },
        ],
      },
      'jsx-a11y': {
        components: {
          Form: 'form',
          Image: 'img',
          Icon: 'svg',
        },
      },
    },
    options: {
      reportUnusedDisableDirectives: 'warn',
      typeAware: true,
      typeCheck: true,
    },
    categories: {
      correctness: 'error',
    },
    rules: {
      'no-unused-vars': 'error',

      // Module boundaries and imports.
      'import/default': 'error',
      'import/no-namespace': 'error',
      'import/no-cycle': 'warn',
      'import/no-duplicates': 'error',
      'import/no-self-import': 'error',
      'import/no-webpack-loader-syntax': 'error',

      // Promise / async correctness. Fire-and-forget work should be written as
      // `void task().catch(...)` so the intent is visible to reviewers and lint.
      'promise/no-callback-in-promise': 'error',
      'promise/no-multiple-resolved': 'error',
      'promise/no-promise-in-callback': 'off',
      'promise/no-return-in-finally': 'error',
      'promise/always-return': 'off',

      // React and React Hooks.
      'react/exhaustive-deps': 'warn',
      'react/rules-of-hooks': 'error',
      'react/button-has-type': 'error',
      'react/checked-requires-onchange-or-readonly': 'error',
      'react/jsx-no-comment-textnodes': 'error',
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-script-url': 'error',
      'react/jsx-no-target-blank': 'error',
      'react/jsx-no-undef': 'error',
      'react/no-children-prop': 'error',
      'react/no-danger-with-children': 'error',
      'react/no-unknown-property': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/style-prop-object': 'error',
      'react/void-dom-elements-no-children': 'error',

      // TypeScript rules that catch runtime bugs without forcing noisy style preferences.
      'typescript/await-thenable': 'error',
      'typescript/no-array-delete': 'error',
      'typescript/no-confusing-void-expression': 'off',
      'typescript/no-deprecated': 'warn',
      'typescript/no-floating-promises': 'error',
      'typescript/no-for-in-array': 'error',
      'typescript/no-implied-eval': 'error',
      'typescript/no-misused-promises': 'error',
      'typescript/no-namespace': 'error',
      'typescript/no-non-null-asserted-optional-chain': 'error',
      'typescript/no-require-imports': 'error',
      'typescript/no-unnecessary-type-assertion': 'off',
      'typescript/no-unsafe-argument': 'off',
      'typescript/no-unsafe-assignment': 'off',
      'typescript/no-unsafe-call': 'off',
      'typescript/no-unsafe-member-access': 'off',
      'typescript/no-unsafe-return': 'off',
      'typescript/no-unsafe-type-assertion': 'off',
      'typescript/prefer-nullish-coalescing': 'off',
      'typescript/prefer-optional-chain': 'off',
      'typescript/restrict-plus-operands': 'warn',
      'typescript/switch-exhaustiveness-check': 'off',

      // React Router and SSR routes intentionally forward props and render trusted HTML.
      'react/jsx-props-no-spread-multi': 'off',
      'react/no-danger': 'off',

      // Existing templates use progressive-enhancement hooks that are noisy with generic a11y heuristics.
      'jsx_a11y/click-events-have-key-events': 'off',
      'jsx_a11y/no-static-element-interactions': 'off',
      'react_perf/jsx-no-new-array-as-prop': 'off',
      'react_perf/jsx-no-new-function-as-prop': 'off',
      'react_perf/jsx-no-new-object-as-prop': 'off',

      // Server modules intentionally read the validated env facade instead of raw process.env.
      'node/no-process-env': 'off',
    },
  },
  staged: {
    '*.{js,jsx,ts,tsx,mjs,cjs}': 'vp fmt && vp lint',
  },
  plugins: [mdxPlugin, reactRouter(), tailwindcss(), ssrFontAssets()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
      '~': path.resolve(rootDir, 'public'),
      '#source': path.resolve(rootDir, '.source'),
    },
  },
  build: {
    emptyOutDir: true,
  },
  server: {
    port: 4321,
  },
})
