import type { Config } from '@react-router/dev/config'

export default {
  appDirectory: 'src',
  ssr: true,
  routeDiscovery: { mode: 'initial' },
  future: {
    v8_middleware: true,
    v8_viteEnvironmentApi: true,
  },
} satisfies Config
