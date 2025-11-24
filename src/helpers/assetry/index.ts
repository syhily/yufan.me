import type { AstroIntegration, AstroIntegrationLogger } from 'astro'
import { createHash } from 'node:crypto'
import { readFile, rm, unlink } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path/posix'
import { joinPaths } from '@astrojs/internal-helpers/path'
import { normalizePath } from 'vite'
import { walk } from './walk'

// Function to upload a file using fetch
async function uploadFile({
  sourcePath,
  targetPath,
  fileName,
  apiKey,
  endpoint,
  logger,
}: {
  sourcePath: string
  targetPath: string
  fileName: string
  apiKey: string
  endpoint: string
  logger: AstroIntegrationLogger
}): Promise<void> {
  // Generate the upload URL
  const url = `${joinPaths(endpoint, targetPath)}?api_key=${apiKey}`

  // Create a file object from the filePath (this assumes you can read the file as Blob or File)
  const formData = new FormData()
  const buffer = await readFile(sourcePath)
  const blob = new Blob([buffer], { type: 'application/octet-stream' })

  formData.append('file', blob, fileName)

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }
    logger.info(`File ${fileName} uploaded successfully!`)
  }
  catch (error) {
    logger.error(`Error: ${error}`)
  }
}

interface DirInfo {
  name: string
  type: 'dir'
}

interface FileInfo {
  name: string
  type: 'file'
  sha256: string
}

type FileOrDir = DirInfo | FileInfo

interface ListResponse {
  path: string
  files: FileOrDir[]
}

// Function to make the GET request and handle the response
async function listFiles({
  apiKey,
  endpoint,
  targetPath,
  logger,
}: {
  apiKey: string
  endpoint: string
  targetPath: string
  logger: AstroIntegrationLogger
}): Promise<ListResponse> {
  // Generate the list URL
  const url = `${joinPaths(endpoint, targetPath)}?api_key=${apiKey}`

  try {
    // Fetching data from the server
    const response = await fetch(url)

    // Check if the response is okay
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    // Parse the JSON response
    const data: ListResponse = await response.json() as ListResponse
    return data
  }
  catch (error) {
    logger.error(`Error fetching file info: ${error}`)
    return { path: targetPath, files: [] }
  }
}

// Type guard to check if the item is a FileInfo (i.e., has sha256 property)
function isFileInfo(fileOrDir: FileOrDir): fileOrDir is FileInfo {
  return fileOrDir.type === 'file'
}

async function uploadFiles({
  uploadPaths,
  apiKey,
  endpoint,
  logger,
}: {
  uploadPaths: {
    rootPath: string
    filePath: string
    recursive: boolean
    keep: boolean
    override: boolean
  }[]
  apiKey: string
  endpoint: string
  logger: AstroIntegrationLogger
}): Promise<void> {
  for (const { rootPath, filePath, recursive, keep, override } of uploadPaths) {
    await walk(rootPath, filePath, { recursive }, async (relative, files) => {
      const results = files.map(file => ({ sourcePath: file.path, targetPath: normalizePath(join('upload', relative)), fileName: file.name }))

      // Upload all the files if the override option is enabled.
      if (override) {
        for (const result of results) {
          logger.info(`Start to override file: ${result.targetPath}`)
          await uploadFile({ ...result, apiKey, endpoint, logger })
        }
      }
      // List all the available files.
      else {
        const prefix = normalizePath(join('upload', relative))
        const response = await listFiles({ apiKey, endpoint, targetPath: prefix, logger })
        for (const result of results) {
          // Check if the file already exists and matches the sha256 hash
          const fileSha256 = await calculateFileSha256(result.sourcePath)
          if (response.files.some(file => isFileInfo(file) && file.name === result.fileName && file.sha256 === fileSha256)) {
            logger.info(`Skipping file upload for ${result.fileName} as it already exists with the same SHA256 hash.`)
            continue
          }

          // Upload file if it's new or different
          logger.info(`Start to upload file: ${result.targetPath}`)
          await uploadFile({ ...result, apiKey, endpoint, logger })
        }
      }

      // Start to delete the files, in this method. We may not delete the directory.
      if (!keep) {
        await Promise.all(files.map(file => unlink(file.path)))
      }
    })

    // Try to delete the uploaded files.
    if (!keep) {
      try {
        // Given this is a dangerous operation. We do not allow the user to use ".." directory.
        await rm(resolve(rootPath, filePath), { recursive: true, force: true })
      }
      catch (err) {
        logger.error(`Failed to remove the ${filePath}.`)
        console.error(err)
      }
    }
  }
}

// Helper function to calculate the sha256 of a file
async function calculateFileSha256(filePath: string): Promise<string> {
  const fileBuffer = await readFile(filePath)
  return createHash('sha256').update(fileBuffer).digest('hex')
}

function isParentPath(rootPath: string, filePath: string) {
  return relative(rootPath, resolve(rootPath, filePath)).startsWith('..')
}

export default function uploader({ apiKey, paths, endpoint }: { apiKey: string, paths: string[], endpoint: string }): AstroIntegration {
  return {
    name: 'Assetry Uploader',
    hooks: {
      'astro:build:done': async ({ dir, logger }: { dir: URL, logger: AstroIntegrationLogger }) => {
        const uploadPaths = paths.map((path) => {
          if (isParentPath(dir.pathname, path)) {
            throw new Error(`It's not allowed to upload the parent directories. Only child directories.`)
          }
          return {
            rootPath: dir.pathname,
            filePath: path,
            recursive: true,
            keep: true,
            override: false,
          }
        })

        logger.info('Start to upload files to Assetry.')
        await uploadFiles({ apiKey, uploadPaths, endpoint, logger })
      },
    },
  }
}
