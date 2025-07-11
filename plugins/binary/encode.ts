const z85: Uint8Array = charsetToMap('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#')

function charsetToMap(charset: string): Uint8Array {
  const ui8a = new Uint8Array(85)
  for (let i = 0; i < 85; i++) {
    ui8a[i] = charset.charAt(i).charCodeAt(0)
  }
  return ui8a
}

export default function encodeBinary(ui8a: Uint8Array): string {
  const remain = ui8a.length % 4
  const last5Length = remain ? remain + 1 : 0
  const length = Math.ceil(ui8a.length * 5 / 4)
  const target = new Uint8Array(length)

  const dw = new DataView(ui8a.buffer, ui8a.byteOffset, ui8a.byteLength)
  const to = Math.trunc(ui8a.length / 4)
  for (let i = 0; i < to; i++) {
    let num = dw.getUint32(4 * i)
    for (let k = 4; k >= 0; k--) {
      target[k + i * 5] = z85[num % 85]
      num = Math.trunc(num / 85)
    }
  }

  if (remain) {
    const lastPartIndex = Math.trunc(ui8a.length / 4) * 4
    const lastPart = Uint8Array.from([...ui8a.slice(lastPartIndex), 0, 0, 0])
    const offset = target.length - last5Length - 1
    const dw = new DataView(lastPart.buffer)
    let num = dw.getUint32(0)
    for (let i = 4; i >= 0; i--) {
      const value = z85[num % 85]
      num = Math.trunc(num / 85)
      if (i < last5Length) {
        const index = offset + i + 1
        target[index] = value
      }
    }
  }

  return new TextDecoder().decode(target)
}
