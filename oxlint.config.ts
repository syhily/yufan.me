import { defineConfig } from 'oxlint'

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
  plugins: ['react', 'jsx-a11y', 'react-perf', 'import', 'typescript', 'unicorn', 'oxc'],
  ignorePatterns,
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
        Link: 'a',
        NavLink: 'a',
        Image: 'img',
        Icon: 'svg',
      },
    },
  },
  options: {
    typeAware: true,
  },
  categories: {
    correctness: 'warn',
  },
  rules: {
    'no-unused-vars': 'error',
    'typescript/no-namespace': 'error',
    'import/no-namespace': 'error',
    'react/exhaustive-deps': 'warn',
    'react/jsx-key': 'error',
    'react/jsx-no-duplicate-props': 'error',
    'react/jsx-no-undef': 'error',
    'react/no-danger-with-children': 'error',
    'react/void-dom-elements-no-children': 'error',

    // React Router and SSR routes intentionally forward props and render trusted HTML.
    'react/jsx-props-no-spread-multi': 'off',
    'react/no-danger': 'off',

    // Existing templates use progressive-enhancement hooks that are noisy with generic a11y heuristics.
    'jsx_a11y/click-events-have-key-events': 'off',
    'jsx_a11y/no-static-element-interactions': 'off',
    'react_perf/jsx-no-new-array-as-prop': 'off',
    'react_perf/jsx-no-new-function-as-prop': 'off',
    'react_perf/jsx-no-new-object-as-prop': 'off',
  },
})
