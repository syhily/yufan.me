import antfu from '@antfu/eslint-config'

export default antfu(
  {
    formatters: true,
    astro: true,
    typescript: true,
    yaml: false,
    rules: {
      'antfu/no-top-level-await': ['off'],
    },
  },
)
