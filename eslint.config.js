import antfu from '@antfu/eslint-config'

export default antfu(
  {
    formatters: true,
    astro: true,
    typescript: true,
    rules: {
      'antfu/no-top-level-await': ['off'],
    },
  },
)
