import type { Buffer } from 'node:buffer'

import sharp from 'sharp'

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
