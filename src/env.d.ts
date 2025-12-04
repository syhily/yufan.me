/// <reference path="../.astro/types.d.ts" />

declare module 'unstorage/drivers/redis' {
  import type { Driver } from 'unstorage'

  export default function redisDriver(options?: any): Driver
}

declare namespace App {
  interface SessionData {
    user: {
      id: bigint
      name: string
      email: string
      website: string | null
      admin: boolean
    }
    csrf: {
      token: string
      timestamp: number
    }
  }
}

namespace NodeJS {
  interface ProcessEnv {
    UPLOAD_STATIC_FILES: string
    S3_ENDPOINT: string
    S3_BUCKET: string
    S3_ACCESS_KEY: string
    S3_SECRET_ACCESS_KEY: string
  }
}
