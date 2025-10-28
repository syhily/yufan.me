import ranges from './ip_ranges.txt?raw'

/**
 * Convert IPv4 string to 32-bit unsigned integer.
 */
function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
}

/**
 * Convert 32-bit unsigned integer to IPv4 string.
 */
function intToIp(int: number): string {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join('.')
}

/**
 * Generate a random usable IP inside a CIDR range.
 * Skips network (first) and broadcast (last) addresses.
 */
function randomIpInCidr(cidr: string): string {
  const [baseIp, prefixStr] = cidr.split('/')
  const prefix = Number(prefixStr)
  const baseInt = ipToInt(baseIp)
  const hostBits = 32 - prefix
  const total = 2 ** hostBits

  if (total <= 2) {
    // /31 or /32 — no usable host addresses
    return intToIp(baseInt)
  }

  // Skip first (network) and last (broadcast)
  const offset = Math.floor(Math.random() * (total - 2)) + 1
  return intToIp(baseInt + offset)
}

/**
 * Load IP ranges from a text file (one CIDR per line).
 */
const ipRanges = ranges
  .split(/\r?\n/)
  .filter(line => line !== '')
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'))

/**
 * Pick a random CIDR range from file and return a random usable IP within it.
 */
export function getRandomChineseIp(): string {
  const range = ipRanges[Math.floor(Math.random() * ipRanges.length)]
  return randomIpInCidr(range)
}
