/// <reference types="vite-plus/client" />

declare module 'unstorage/drivers/redis' {
  import type { Driver } from 'unstorage'

  export default function redisDriver(options?: unknown): Driver
}
