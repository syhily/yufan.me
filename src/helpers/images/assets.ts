import { Buffer } from 'node:buffer'
import { gunzipSync } from 'node:zlib'
import sharp from 'sharp'
import OPPOSans from '@/assets/fonts/oppo/opposans.ttf?binary'
import OPPOSerif from '@/assets/fonts/oppo/opposerif.ttf?binary'
import LogoDark from '~/logo-dark.svg?binary'
import LogoLight from '~/logo.svg?binary'

function decompress(buffer: Uint8Array): Buffer {
  return gunzipSync(Buffer.from(buffer))
}

// Cache it instead of decompressing it every time.
const OPPOSansBuffer = decompress(OPPOSans)
const OPPOSerifBuffer = decompress(OPPOSerif)
const LogoDarkBuffer = decompress(LogoDark)
const LogoLightBuffer = decompress(LogoLight)

export function logoDark(): Buffer {
  return LogoDarkBuffer
}

export function logoLight(): Buffer {
  return LogoLightBuffer
}

export function oppoSans(): Buffer {
  return OPPOSansBuffer
}

export function oppoSerif(): Buffer {
  return OPPOSerifBuffer
}

export async function compressImage(buf: Buffer): Promise<Buffer> {
  return await sharp(buf)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
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
