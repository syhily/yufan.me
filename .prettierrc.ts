import type { Config } from 'prettier'

const config: Config = {
  plugins: ['prettier-plugin-astro', 'prettier-plugin-astro-organize-imports'],
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
        printWidth: 120,
        tabWidth: 2,
        useTabs: false,
        singleQuote: true,
        semi: false,
        trailingComma: 'all',
        astroOrganizeImportsMode: 'SortAndCombine',
      },
    },
  ],
}

export default config
