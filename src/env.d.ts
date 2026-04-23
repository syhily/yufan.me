/// <reference types="vite/client" />

declare module 'unstorage/drivers/redis' {
  import type { Driver } from 'unstorage'

  export default function redisDriver(options?: unknown): Driver
}

declare namespace NodeJS {
  interface ProcessEnv {
    SITE?: string
    LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error'
    HOST?: string
    PORT?: string
    DATABASE_URL?: string
    REDIS_URL?: string
    SESSION_SECRET?: string
    ZEABUR_MAIL_HOST?: string
    ZEABUR_MAIL_API_KEY?: string
    ZEABUR_MAIL_SENDER?: string
    UPLOAD_STATIC_FILES?: string
    ASSET_BASE_URL?: string
    S3_ENDPOINT?: string
    S3_REGION?: string
    S3_BUCKET?: string
    S3_ACCESS_KEY?: string
    S3_SECRET_ACCESS_KEY?: string
    S3_PREFIX?: string
  }
}

interface ImportMetaEnv {
  readonly SITE: string
}
