import { defineConfig } from 'oxfmt'

const ignorePatterns = [
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
  'coverage',
]

export default defineConfig({
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
  semi: false,
  trailingComma: 'all',
  ignorePatterns,
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
})
