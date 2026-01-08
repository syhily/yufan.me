import type { SupportedPHPVersion } from '@php-wasm/universal'
import { LatestSupportedPHPVersion } from '@php-wasm/universal'

/**
 * Returns the path to the intl extension for the specified PHP version.
 *
 * Each PHP version's intl extension is packaged separately. Install the
 * version-specific package you need:
 * - @php-wasm/node-8-5
 * - @php-wasm/node-8-4
 * - etc.
 */
export async function getIntlExtensionModule(
  version: SupportedPHPVersion = LatestSupportedPHPVersion,
): Promise<any> {
  switch (version) {
    case '7.2':
      // @ts-expect-error This is a dynamic import, and the package may not be installed. The caller should handle this error.
      return (await import('@php-wasm/node-7-2')).getIntlExtensionPath()
  }
  throw new Error(`Unsupported PHP version ${version}`)
}
