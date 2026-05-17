import type { FinalizeRequestMiddleware } from '@smithy/types'

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
  type ServiceInputTypes,
  type ServiceOutputTypes,
} from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'

import type { AssetsSettings } from '@/shared/config/blog'

import { ActionFailure } from '@/server/infra/http/errors'
import { getLogger } from '@/server/infra/logger'
import { requireBlogSettingsSection } from '@/shared/config/blog'

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
 * `@/server/domains/images/storage` is the canonical entry point — callers
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
  installDeleteObjectsMd5Fallback(client)
  globalForS3.imageS3CachedClient = { fingerprint, client }
  return { client, bucket: storage.bucket }
}

// AWS SDK v3 (>= 3.729.0) defaults to CRC32 for `DeleteObjects`. Several
// S3-compatible providers (Backblaze B2, MinIO older builds, some Aliyun
// OSS configurations, Cloudflare R2 in certain regions) reject those
// requests with `ErrMissingContentMD5` because they only honor the legacy
// `Content-MD5` header for that one operation. The documented fallback
// (https://github.com/aws/aws-sdk-js-v3/blob/main/supplemental-docs/MD5_FALLBACK.md)
// is to install a middleware AFTER `flexibleChecksumsMiddleware` that
// strips the modern checksum headers and replaces them with `Content-MD5`.
// Doing it here centralises the workaround for every caller of
// `getImageStorageContext()` (runtime image deletes, the music admin,
// any future bulk-delete script).
function installDeleteObjectsMd5Fallback(client: S3Client): void {
  const middleware: FinalizeRequestMiddleware<ServiceInputTypes, ServiceOutputTypes> =
    (next, context) => async (args) => {
      if (context.commandName !== 'DeleteObjectsCommand') {
        return next(args)
      }
      const request = args.request as { headers: Record<string, string>; body?: unknown }
      for (const header of Object.keys(request.headers)) {
        const lower = header.toLowerCase()
        if (lower.startsWith('x-amz-checksum-') || lower.startsWith('x-amz-sdk-checksum-')) {
          delete request.headers[header]
        }
      }
      if (request.body !== undefined && request.body !== null) {
        const body = Buffer.from(request.body as string | Uint8Array)
        request.headers['Content-MD5'] = createHash('md5').update(body).digest('base64')
      }
      return next(args)
    }
  // Two timing constraints:
  //   1. `flexibleChecksumsMiddleware` runs in the `build` step and adds
  //      `x-amz-checksum-*` headers — we must run AFTER it so we can
  //      strip those headers and replace them with `Content-MD5`.
  //   2. `httpSigningMiddleware` runs in the `finalizeRequest` step and
  //      signs the request based on the headers it sees — we must run
  //      BEFORE it, otherwise the new `Content-MD5` is unsigned and the
  //      bucket rejects the request with `ErrUnsignedHeaders`.
  //
  // The SDK no longer registers `flexibleChecksumsMiddleware` on the
  // client stack (it lives on the per-command stack), so an
  // `addRelativeTo(after, 'flexibleChecksumsMiddleware')` would throw
  // "middleware is not found". `httpSigningMiddleware`, however, IS on
  // the client stack via `getHttpSigningPlugin`, so anchoring `before`
  // it satisfies both constraints — anything in the `build` step has
  // already executed by the time we reach `finalizeRequest`.
  client.middlewareStack.addRelativeTo(middleware, {
    relation: 'before',
    toMiddleware: 'httpSigningMiddleware',
    name: 'addMD5ChecksumForDeleteObjects',
    tags: ['MD5_FALLBACK'],
  })
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

export interface S3ObjectMeta {
  key: string
  size: number
  lastModified: Date
}

export async function listS3Objects(prefix: string): Promise<S3ObjectMeta[]> {
  const { client, bucket } = getImageStorageContext({ requireEnabled: false })
  const objects: S3ObjectMeta[] = []
  let continuationToken: string | undefined
  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )
    for (const item of response.Contents ?? []) {
      if (item.Key && item.LastModified && item.Size !== undefined) {
        objects.push({ key: item.Key, size: item.Size, lastModified: item.LastModified })
      }
    }
    continuationToken = response.NextContinuationToken
  } while (continuationToken)
  return objects
}

export async function getS3ObjectBuffer(key: string): Promise<Buffer> {
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

export async function putS3Object(key: string, body: Buffer | Readable, contentType?: string): Promise<void> {
  const { client, bucket } = getImageStorageContext()
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'private, max-age=31536000',
    }),
  )
}

export async function deleteS3Objects(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return
  }
  const { client, bucket } = getImageStorageContext()
  await client.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: keys.map((key) => ({ Key: key })) },
    }),
  )
}

// `buildPublicUrl` lives in `@/server/render/image-enhance` and
// reads the live `publicBaseUrl` through `@/server/domains/images/storage`'s
// dispatcher. Keeping it out of this module is what allows the SSR
// enhancer to stay free of the AWS SDK in code paths that only need
// to compute a URL (no PUT/DELETE).
