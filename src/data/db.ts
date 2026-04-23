// Re-exports the drizzle handle and schema from the existing helpers/db
// location. By funnelling all repository imports through `@/data/db` we get a
// single chokepoint we can later swap (e.g. transactions, read-replicas) and
// it makes the rule "drizzle is only called inside data/repositories" easy to
// audit (search for `from '@/data/db'`).

export { db } from '@/helpers/db/pool'
export * as schema from '@/helpers/db/schema'
export type {
  Comment,
  Like,
  NewComment,
  NewLike,
  NewPage,
  NewUser,
  NewVerification,
  Page,
  User,
  Verification,
} from '@/helpers/db/types'
