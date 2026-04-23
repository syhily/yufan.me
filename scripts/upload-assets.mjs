import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ASSETS_DIR = path.resolve('build/client/assets')
const CACHE_CONTROL = 'public, max-age=31536000, immutable'
const CONCURRENCY = 8

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml; charset=utf-8'],
])

async function exists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

function requireEnv(key) {
  const value = process.env[key]
  if (!value || value.trim() === '') {
    throw new Error(`[upload-assets] Missing required environment variable: ${key}`)
  }
  return value.trim()
}

function normalizePrefix(prefix) {
  return prefix.replace(/^\/+|\/+$/g, '')
}

function prefixFromAssetBaseUrl() {
  const base = process.env.ASSET_BASE_URL?.trim()
  if (!base) {
    return ''
  }

  try {
    return normalizePrefix(new URL(base).pathname)
  } catch {
    return normalizePrefix(base)
  }
}

function uploadPrefix() {
  const explicit = process.env.S3_PREFIX?.trim()
  if (explicit) {
    return normalizePrefix(explicit)
  }
  return prefixFromAssetBaseUrl()
}

function objectKey(relativePath, prefix) {
  const key = relativePath.split(path.sep).join('/')
  return prefix ? `${prefix}/assets/${key}` : `assets/${key}`
}

function contentType(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream'
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        return listFiles(entryPath)
      }
      if (entry.isFile()) {
        return [entryPath]
      }
      return []
    }),
  )
  return files.flat()
}

async function runPool(items, worker) {
  let index = 0
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++]
      await worker(current)
    }
  })
  await Promise.all(workers)
}

async function main() {
  if (process.env.UPLOAD_STATIC_FILES !== 'true') {
    return
  }

  if (!(await exists(ASSETS_DIR))) {
    console.warn(`[upload-assets] skip: missing ${ASSETS_DIR}`)
    return
  }

  const bucket = requireEnv('S3_BUCKET')
  const endpoint = requireEnv('S3_ENDPOINT')
  const accessKeyId = requireEnv('S3_ACCESS_KEY')
  const secretAccessKey = requireEnv('S3_SECRET_ACCESS_KEY')
  const region = process.env.S3_REGION?.trim() || 'auto'
  const prefix = uploadPrefix()

  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  const files = await listFiles(ASSETS_DIR)
  await runPool(files, async (filePath) => {
    const relativePath = path.relative(ASSETS_DIR, filePath)
    const key = objectKey(relativePath, prefix)
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: await fs.readFile(filePath),
        CacheControl: CACHE_CONTROL,
        ContentType: contentType(filePath),
      }),
    )
    console.info(`[upload-assets] uploaded ${key}`)
  })

  console.info(`[upload-assets] uploaded ${files.length} asset(s) to s3://${bucket}/${prefix}`)
}

await main()
