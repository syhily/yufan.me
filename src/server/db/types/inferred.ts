import type {
  category,
  comment,
  content,
  doc,
  friend,
  image,
  like,
  music,
  page,
  setting,
  tag,
  user,
  verification,
} from '@/server/db/schema'

// Types for insert
export type NewPage = typeof page.$inferInsert
export type NewUser = typeof user.$inferInsert
export type NewLike = typeof like.$inferInsert
export type NewComment = typeof comment.$inferInsert
export type NewVerification = typeof verification.$inferInsert
export type NewSetting = typeof setting.$inferInsert
export type NewFriend = typeof friend.$inferInsert
export type NewCategory = typeof category.$inferInsert
export type NewTag = typeof tag.$inferInsert
export type NewImage = typeof image.$inferInsert
export type NewMusic = typeof music.$inferInsert
// `NewPageMeta` / `NewContent` use the business-layer alias the rest
// of the codebase reads via `import { doc as pageMetaTable }`.
export type NewPageMeta = typeof doc.$inferInsert
export type NewContent = typeof content.$inferInsert

// Types for select
export type Page = typeof page.$inferSelect
export type User = typeof user.$inferSelect
export type Like = typeof like.$inferSelect
export type Comment = typeof comment.$inferSelect
export type Verification = typeof verification.$inferSelect
export type Setting = typeof setting.$inferSelect
// `FriendRow` instead of `Friend` to avoid colliding with the public
// `Friend` DTO exported from `@/shared/catalog` — UI consumers import
// the DTO, server-side query/service code imports the row.
export type FriendRow = typeof friend.$inferSelect
// `CategoryRow` / `TagRow` follow the same naming rule: the public
// DTOs from `@/shared/catalog` already own the unsuffixed names.
export type CategoryRow = typeof category.$inferSelect
export type TagRow = typeof tag.$inferSelect
// `ImageRow` follows the same convention: the public `AdminImageDto`
// exported from `@/shared/images` carries the projection used in the
// admin UI.
export type ImageRow = typeof image.$inferSelect
// `MusicRow` ditto: the public `AdminMusicDto` from `@/shared/music`
// is the projection consumed by UI; the row stays server-side only.
export type MusicRow = typeof music.$inferSelect
// `PageMetaRow` / `ContentRow` are the schema-projected row types for
// the new doc/content tables. The unsuffixed `Page` type above is the
// historical metric counter row (will become `Metric` once the
// physical rename is in flight).
export type PageMetaRow = typeof doc.$inferSelect
export type ContentRow = typeof content.$inferSelect
