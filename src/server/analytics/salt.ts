import { randomBytes } from 'node:crypto'

// Daily-rotating salt for `visitorHash`. In-memory only — UV counts
// reset across process restarts AND across replicas. For a personal
// blog with a single Node process this is acceptable; the alternative
// is a Redis-backed salt with `SET analytics:salt:<date> NX EX 86400`
// which is the documented upgrade path (see
// `docs/blog-analytics-plan.md §R7`).
//
// Why a fresh salt every UTC day:
//   - Stable WITHIN a day → `COUNT(DISTINCT visitor_hash)` on a 24h
//     window returns honest UVs.
//   - Anonymous ACROSS days → the same IP doesn't reveal which days a
//     given visitor returned, blunting the linkability of the raw `ip`
//     column. (We still store the raw IP per `docs/blog-analytics-plan.md §D3`,
//     but the hash gives the dashboard a path off the raw value if
//     compliance ever flips.)

let currentSalt = randomBytes(32).toString('hex')
let currentDay = currentUtcDay()

function currentUtcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getDailySalt(): string {
  const today = currentUtcDay()
  if (today !== currentDay) {
    currentSalt = randomBytes(32).toString('hex')
    currentDay = today
  }
  return currentSalt
}
