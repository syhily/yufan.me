import { defineConfig } from 'oxlint'

export default defineConfig({
  ignorePatterns: ['**/*.mdx', '**/*.md', 'node_modules', 'public', 'dist', '.astro'],
  options: {
    typeAware: true,
  },
  categories: {
    correctness: 'warn',
  },
  rules: {
    'eslint/no-unused-vars': 'error',
  },
})
