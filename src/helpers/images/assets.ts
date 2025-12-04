import { Buffer } from 'node:buffer'
import { gunzipSync } from 'node:zlib'
import OPPOSans from '@/assets/fonts/oppo/opposans.ttf?binary'
import OPPOSerif from '@/assets/fonts/oppo/opposerif.ttf?binary'
import LogoDark from '~/logo-dark.svg?binary'

function decompress(buffer: Uint8Array): Buffer {
  return gunzipSync(Buffer.from(buffer))
}

export function logoDark(): Buffer {
  return decompress(LogoDark)
}

export function oppoSans(): Buffer {
  return decompress(OPPOSans)
}

export function oppoSerif(): Buffer {
  return decompress(OPPOSerif)
}
