import type { PHPLoaderModule, SupportedPHPVersion } from '@php-wasm/universal'
import { LatestSupportedPHPVersion } from '@php-wasm/universal'

/**
 * Loads the PHP loader module for the given PHP version.
 *
 * Each PHP version is packaged separately to reduce bundle size:
 * - @php-wasm/node-8-5
 * - @php-wasm/node-8-4
 * - @php-wasm/node-8-3
 * - etc.
 *
 * @param version The PHP version to load.
 * @returns The PHP loader module.
 */
export async function getPHPLoaderModule(
  version: SupportedPHPVersion = LatestSupportedPHPVersion,
): Promise<PHPLoaderModule> {
  switch (version) {
    case '7.2':
      // @ts-expect-error This is a dynamic import, and the package may not be installed. The caller should handle this error.
      return (await import('@php-wasm/node-7-2')).getPHPLoaderModule()
  }
  throw new Error(`Unsupported PHP version ${version}`)
}
