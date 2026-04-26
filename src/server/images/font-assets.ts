import type { Buffer } from 'node:buffer'

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

interface RuntimeAsset {
  runtimePath: string
  sourcePath: string
}

const cache = new Map<string, Buffer>()

const assets = {
  logoDark: { runtimePath: 'logo-dark.svg', sourcePath: 'public/logo-dark.svg' },
  logoLight: { runtimePath: 'logo.svg', sourcePath: 'public/logo.svg' },
  oppoSans: {
    runtimePath: 'assets/opposans.ttf',
    sourcePath: 'src/assets/fonts/oppo/opposans.ttf',
  },
  oppoSerif: {
    runtimePath: 'assets/opposerif.ttf',
    sourcePath: 'src/assets/fonts/oppo/opposerif.ttf',
  },
} satisfies Record<string, RuntimeAsset>

function readAsset(asset: RuntimeAsset): Buffer {
  let buffer = cache.get(asset.runtimePath)
  if (buffer === undefined) {
    buffer = readFileSync(resolveAssetPath(asset))
    cache.set(asset.runtimePath, buffer)
  }
  return buffer
}

function resolveAssetPath(asset: RuntimeAsset): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(moduleDir, '..', asset.runtimePath),
    path.resolve(process.cwd(), 'build/server', asset.runtimePath),
    path.resolve(process.cwd(), 'build/client', asset.runtimePath),
    path.resolve(process.cwd(), asset.runtimePath),
    path.resolve(process.cwd(), asset.sourcePath),
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

export function logoDark(): Buffer {
  return readAsset(assets.logoDark)
}

export function logoLight(): Buffer {
  return readAsset(assets.logoLight)
}

export function oppoSans(): Buffer {
  return readAsset(assets.oppoSans)
}

export function oppoSerif(): Buffer {
  return readAsset(assets.oppoSerif)
}
