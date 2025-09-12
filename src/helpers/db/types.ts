import type { comment, like, page, user, verification } from '@/helpers/db/schema'

// Types for insert
export type NewPage = typeof page.$inferInsert
export type NewUser = typeof user.$inferInsert
export type NewLike = typeof like.$inferInsert
export type NewComment = typeof comment.$inferInsert
export type NewVerification = typeof verification.$inferInsert

// Types for select
export type Page = typeof page.$inferSelect
export type User = typeof user.$inferSelect
export type Like = typeof like.$inferSelect
export type Comment = typeof comment.$inferSelect
export type Verification = typeof verification.$inferSelect
