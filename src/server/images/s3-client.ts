import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'

import type { AssetsSettings } from '@/shared/blog-config'

import { getLogger } from '@/server/logger'
import { ActionFailure } from '@/server/route-helpers/api-handler'
import { requireBlogSettingsSection } from '@/shared/blog-config'

// Lazily-built `S3Client` keyed by the JSON-serialised storage config.
// `requireBlogSettingsSection('assets').storage` returns the most recent
// snapshot bucket; whenever the admin saves the settings page the
// snapshot is rewritten and we get a fresh object identity, so the
// stringified key changes and we rebuild the client. The cache prevents
// thrashing on every call within a single request — important because
// the admin list view can resolve dozens of `publicUrl`s back-to-back.
//
// We hold at most one client at a time. When a fresh config arrives the
// previous client is destroyed so its in-flight HTTP/2 connection pool
// drains and we don't leak file descriptors after a key rotation.

const log = getLogger('images.s3')

interface CachedClient {
  fingerprint: string
  client: S3Client
}

const globalForS3 = globalThis as unknown as {
  imageS3CachedClient: CachedClient | undefined
}

function fingerprintFor(storage: AssetsSettings['storage']): string {
  return JSON.stringify({
    endpoint: storage.endpoint,
    region: storage.region,
    bucket: storage.bucket,
    accessKeyId: storage.accessKeyId,
    forcePathStyle: storage.forcePathStyle,
    secretFingerprint: storage.secretAccessKey === '' ? '<empty>' : 'present',
  })
}

export interface ImageStorageContext {
  client: S3Client
  bucket: string
}

/**
 * Resolve the live S3 client + bucket name for the current request.
 * Throws `ActionFailure(503)` when the upload toggle is OFF or when
 * the credentials are half-configured. The dispatcher in
 * `@/server/images/storage` is the canonical entry point — callers
 * should not reach this helper directly.
 */
export function getImageStorageContext(options?: { requireEnabled?: boolean }): ImageStorageContext {
  const settings = requireBlogSettingsSection('assets')
  const storage = settings.storage
  if (options?.requireEnabled !== false && !storage.enabled) {
    throw new ActionFailure(503, '图片上传未开启；请到 /wp-admin/settings/assets 打开「启用 S3 上传」')
  }
  if (storage.secretAccessKey === '') {
    throw new ActionFailure(503, '请先在 /wp-admin/settings/assets 配置 S3 凭据')
  }

  const fingerprint = fingerprintFor(storage)
  const cached = globalForS3.imageS3CachedClient
  if (cached !== undefined && cached.fingerprint === fingerprint) {
    return { client: cached.client, bucket: storage.bucket }
  }

  if (cached !== undefined) {
    try {
      cached.client.destroy()
    } catch (error) {
      log.warn('Failed to destroy stale S3 client', { error })
    }
  }

  const config: S3ClientConfig = {
    endpoint: storage.endpoint,
    region: storage.region,
    forcePathStyle: storage.forcePathStyle,
    credentials: {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
    },
    // Some S3-compatible services return base64-encoded Content-MD5 while
    // the AWS SDK v3 expects hex, causing a false "Checksum mismatch" on
    // GetObject. WHEN_REQUIRED skips automatic response validation unless
    // the caller explicitly asks for it (ChecksumMode: ENABLED).
    responseChecksumValidation: 'WHEN_REQUIRED',
  }
  const client = new S3Client(config)
  globalForS3.imageS3CachedClient = { fingerprint, client }
  return { client, bucket: storage.bucket }
}

export interface PutImageObjectInput {
  key: string
  body: Buffer
  contentType: string
  cacheControl?: string
}

export async function putImageObject(input: PutImageObjectInput): Promise<void> {
  const { client, bucket } = getImageStorageContext()
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl ?? 'public, max-age=31536000, immutable',
    }),
  )
}

export async function deleteImageObject(key: string): Promise<void> {
  const { client, bucket } = getImageStorageContext()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export async function headImageObject(key: string): Promise<boolean> {
  const { client, bucket } = getImageStorageContext()
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (error) {
    // The AWS SDK throws on 404 with `name === 'NotFound'` (or
    // `$metadata.httpStatusCode === 404`). Any other error bubbles up so
    // callers don't silently mistake a 5xx for "object missing".
    if (error instanceof Error && (error.name === 'NotFound' || error.name === 'NoSuchKey')) {
      return false
    }
    throw error
  }
}

export async function getImageObject(key: string): Promise<Buffer> {
  const { client, bucket } = getImageStorageContext({ requireEnabled: false })
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (response.Body === undefined) {
    throw new ActionFailure(404, 'S3 对象不存在或内容为空')
  }

  const stream = response.Body as Readable
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', (err: Error) => reject(err))
  })
}

// `buildPublicUrl` lives in `@/server/images/render-enhance` and
// reads the live `publicBaseUrl` through `@/server/images/storage`'s
// dispatcher. Keeping it out of this module is what allows the SSR
// enhancer to stay free of the AWS SDK in code paths that only need
// to compute a URL (no PUT/DELETE).
