import { Buffer } from 'node:buffer'
import { gunzipSync } from 'node:zlib'

import OPPOSans from '@/assets/fonts/opposans.ttf?binary'
import OPPOSerif from '@/assets/fonts/opposerif.ttf?binary'
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
