import antfu from '@antfu/eslint-config'

export default antfu(
  {
    formatters: {
      css: true,
      html: true,
      markdown: 'prettier',
      astro: 'prettier',
    },
    astro: true,
    typescript: true,
    yaml: false,
    rules: {
      'antfu/no-top-level-await': ['off'],
    },
  },
)
