/// <reference types="node" />
/// <reference types="vite/client" />
/// <reference types="vite-plus/client" />
/// <reference types="vite-plugin-binary/types" />
/// <reference types="vite-plugin-font/src/font" />

declare module 'unstorage/drivers/redis' {
  import type { Driver } from 'unstorage'

  export default function redisDriver(options?: unknown): Driver
}

declare module 'katex/contrib/mhchem' {}
