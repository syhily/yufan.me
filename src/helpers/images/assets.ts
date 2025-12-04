import { Buffer } from 'node:buffer'
import { gunzipSync } from 'node:zlib'
import OPPOSans from '@/assets/fonts/oppo/opposans.ttf?binary'
import OPPOSerif from '@/assets/fonts/oppo/opposerif.ttf?binary'
import LogoDark from '~/logo-dark.svg?binary'
import LogoLight from '~/logo.svg?binary'

function decompress(buffer: Uint8Array): Buffer {
  return gunzipSync(Buffer.from(buffer))
}

export function logoDark(): Buffer {
  return decompress(LogoDark)
}

export function logoLight(): Buffer {
  return decompress(LogoLight)
}

export function oppoSans(): Buffer {
  return decompress(OPPOSans)
}

export function oppoSerif(): Buffer {
  return decompress(OPPOSerif)
}

export async function compressImage(buf: Buffer): Promise<Buffer> {
  const { default: sharp } = await import('sharp')
  return await sharp(buf)
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      force: true,
      palette: true,
      quality: 75,
      progressive: true,
    })
    .toBuffer()
}
