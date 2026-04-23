import type { Config } from '@react-router/dev/config'

export default {
  appDirectory: 'src',
  ssr: true,
  future: {
    v8_middleware: true,
  },
} satisfies Config
