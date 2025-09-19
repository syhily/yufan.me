import crypto from 'node:crypto'

export function makeToken(length: number, characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  let result = ''
  const charactersLength = characters.length
  let counter = 0
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
    counter += 1
  }
  return result
}

export function encodedEmail(email: string): string {
  return crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex')
}

export function isNumeric(str: string): boolean {
  return /^-?\d+$/.test(str)
}
