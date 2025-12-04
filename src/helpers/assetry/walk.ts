import { readdir, stat } from 'node:fs/promises'
import { basename, join, normalize, relative, resolve } from 'node:path'

/**
 * @param relative The relative directory name.
 * @param files: The files to walk.
 */
export type WalkFn = (relative: string, files: { path: string, name: string }[]) => Promise<void>

export interface WalkOptions {
  /**
   * Whether to reclusive all the sub directories locates beneath the root directory.
   */
  recursive: boolean
}

/**
 * Walk for currently directory of file.
 *
 * @param root The root path for your to visit.
 * @param file The relative path compare with root path. It could be a file or a directory.
 * @param options Whether to walk reclusive through the root directory.
 * @param walkFn The function to walk for all the files locates for current directory.
 */
export async function walk(root: string, file: string, options: WalkOptions, walkFn: WalkFn): Promise<void> {
  const rootPath = resolve(root)
  const walkPath = resolve(join(rootPath, file))
  const type = await stat(walkPath)
  if (type.isFile()) {
    walkFn(relative(rootPath, walkPath), [{ path: walkPath, name: basename(walkPath) }])
  }

  const results = await readdir(walkPath, { withFileTypes: true })

  // Walk all the child directories in current directory first.
  if (options.recursive) {
    await Promise.all(results.filter(result => result.isDirectory())
      .filter(result => !result.name.startsWith('.'))
      .map(async result => walk(root, join(file, result.name), options, walkFn)))
  }

  // Walk all the files in current directory.
  const files = results.filter(result => result.isFile())
    .filter(result => !result.name.startsWith('.'))
    .map(result => ({
      path: normalize(join(result.parentPath, result.name)),
      name: result.name,
    }))

  // Skip the empty directory.
  if (files.length > 0) {
    await walkFn(relative(rootPath, walkPath), files)
  }
}
