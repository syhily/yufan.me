import type { PluginOption } from 'vite'
import { promises } from 'node:fs'
import encodeBinary from './encode'

const decodeBinaryRaw = `const z85 = charsetToMap('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#')
const pow2 = 7225
const pow3 = 614125
const pow4 = 52200625

function charsetToMap(charset) {
  const ui8a = new Uint8Array(85)
  for (let i = 0; i < 85; i++) {
    ui8a[i] = charset.charAt(i).charCodeAt(0)
  }
  return ui8a
}

function getReverseMap(mapOrig) {
  const revMap = new Uint8Array(128)
  for (const [num, charCode] of Object.entries(mapOrig)) {
    revMap[charCode] = Number.parseInt(num)
  }
  return revMap
}

export default function decodeBinary(base85) {
  const revMap = getReverseMap(z85)

  const base85ab = new TextEncoder().encode(base85)
  const pad = (5 - (base85ab.length % 5)) % 5

  const ints = new Uint8Array((Math.ceil(base85ab.length / 5) * 4) - pad)
  let dw = new DataView(ints.buffer)
  let i = 0
  for (; i < base85ab.length / 5 - 1; i++) {
    const c1 = revMap[base85ab[i * 5 + 4]]
    const c2 = revMap[base85ab[i * 5 + 3]] * 85
    const c3 = revMap[base85ab[i * 5 + 2]] * pow2
    const c4 = revMap[base85ab[i * 5 + 1]] * pow3
    const c5 = revMap[base85ab[i * 5]] * pow4
    dw.setUint32(i * 4, c1 + c2 + c3 + c4 + c5)
  }

  const lCh = z85[z85.length - 1]
  const lastPart = new Uint8Array([...base85ab.slice(i * 5), lCh, lCh, lCh, lCh])
  dw = new DataView(lastPart.buffer)
  const c1 = revMap[lastPart[4]]
  const c2 = revMap[lastPart[3]] * 85
  const c3 = revMap[lastPart[2]] * pow2
  const c4 = revMap[lastPart[1]] * pow3
  const c5 = revMap[lastPart[0]] * pow4
  dw.setUint32(0, c1 + c2 + c3 + c4 + c5)
  for (let j = 0; j < 4 - pad; j++) {
    ints[i * 4 + j] = lastPart[j]
  }

  return ints
}
`

export default function vitePluginBinary(): PluginOption {
  return {
    name: 'vite-plugin-binary',
    resolveId(id) {
      if (id === 'virtual:decode-binary') {
        return id
      }
    },
    load(id) {
      if (id === 'virtual:decode-binary') {
        return decodeBinaryRaw
      }
    },
    async transform(_src, id) {
      if (id.endsWith('?binary')) {
        const file = id.slice(0, -7)
        this.addWatchFile(file)

        const buffer = await promises.readFile(file)
        const b64 = encodeBinary(buffer)

        return {
          code: `import decodeBinary from 'virtual:decode-binary'\nexport default decodeBinary("${b64}")`,
          map: { mappings: '' },
        }
      }
    },
  }
}
