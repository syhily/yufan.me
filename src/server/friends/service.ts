import type { FriendRow } from '@/server/db/types'
import type { AdminFriendDto } from '@/shared/friends'

import {
  type AdminFriendsListFilters,
  countAdminFriends,
  deleteFriend as deleteFriendRow,
  findFriendByHomepage,
  findFriendById,
  insertFriend,
  listAdminFriendRows,
  listPublicFriendRows,
  updateFriend,
} from '@/server/db/query/friend'
import { DomainError } from '@/server/route-helpers/errors'

// Public projection (no `id`/`visible`/`createdAt`/`updatedAt`/`rssUrl`).
// The `Friend` shape exported from `@/shared/catalog` already matches —
// we just produce that DTO so the catalog stays decoupled from the DB
// row layout.
export interface PublicFriend {
  website: string
  description?: string
  homepage: string
  poster: string
}

export function toPublicFriend(row: FriendRow): PublicFriend {
  return {
    website: row.website,
    description: row.description ?? undefined,
    homepage: row.homepage,
    poster: row.poster,
  }
}

// Wire-format DTO returned by every admin friend endpoint. Bigint id
// stringified so the browser bundle never touches BigInt.
export function toAdminFriendDto(row: FriendRow): AdminFriendDto {
  return {
    id: String(row.id),
    website: row.website,
    description: row.description,
    homepage: row.homepage,
    poster: row.poster,
    rssUrl: row.rssUrl,
    visible: row.visible,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listPublicFriends(): Promise<PublicFriend[]> {
  const rows = await listPublicFriendRows()
  return rows.map(toPublicFriend)
}

export interface AdminFriendsListResult {
  friends: AdminFriendDto[]
  total: number
  /** True when `offset + rows.length < total` (i.e. another page exists). */
  hasMore: boolean
}

// Server-side pagination: parallel `[rows, total]` so we pay only one
// round-trip for the page-of-rows query and the COUNT(*). `total` is
// the full filtered count (independent of `offset`/`limit`) so the
// client can render the correct number of pagination buttons.
export async function listFriendsForAdmin(filters: AdminFriendsListFilters): Promise<AdminFriendsListResult> {
  const offset = filters.offset ?? 0
  const [rows, total] = await Promise.all([
    listAdminFriendRows(filters),
    countAdminFriends({ q: filters.q, includeHidden: filters.includeHidden }),
  ])
  return {
    friends: rows.map(toAdminFriendDto),
    total,
    hasMore: offset + rows.length < total,
  }
}

export interface UpsertFriendInputs {
  id?: bigint
  website: string
  description?: string | null
  homepage: string
  poster: string
  rssUrl?: string | null
  visible: boolean
}

// Single entry-point that the admin Resource Route action calls. The
// `id` distinguishes update from create; on create we soft-check
// `homepage` against existing rows to nudge the editor away from
// accidental duplicates (a hard UNIQUE constraint in the DB would
// reject benign protocol/trailing-slash variants the editor probably
// meant as updates — this stays at the service layer so the admin can
// still force the duplicate by editing the existing row directly).
export async function upsertAdminFriend(input: UpsertFriendInputs): Promise<AdminFriendDto> {
  const description = normaliseNullable(input.description)
  const rssUrl = normaliseNullable(input.rssUrl)

  if (input.id === undefined) {
    const dup = await findFriendByHomepage(input.homepage)
    if (dup !== null) {
      throw new DomainError('CONFLICT', '已存在相同主页 URL 的友链', [
        { message: '主页 URL 已存在', path: ['homepage'] },
      ])
    }
    const row = await insertFriend({
      website: input.website,
      description,
      homepage: input.homepage,
      poster: input.poster,
      rssUrl,
      visible: input.visible,
    })
    return toAdminFriendDto(row)
  }

  const existing = await findFriendById(input.id)
  if (existing === null) {
    throw new DomainError('NOT_FOUND', '友链不存在')
  }
  // Allow the editor to keep the same `homepage` (it's the same row)
  // but reject collisions with OTHER rows so two friend entries can't
  // share the same URL by accident.
  if (existing.homepage !== input.homepage) {
    const dup = await findFriendByHomepage(input.homepage)
    if (dup !== null && dup.id !== input.id) {
      throw new DomainError('CONFLICT', '已存在相同主页 URL 的友链', [
        { message: '主页 URL 已存在', path: ['homepage'] },
      ])
    }
  }
  const updated = await updateFriend(input.id, {
    website: input.website,
    description,
    homepage: input.homepage,
    poster: input.poster,
    rssUrl,
    visible: input.visible,
  })
  if (updated === null) {
    throw new DomainError('NOT_FOUND', '友链不存在')
  }
  return toAdminFriendDto(updated)
}

export async function deleteAdminFriend(id: bigint): Promise<boolean> {
  return deleteFriendRow(id)
}

// Trim and collapse the empty string to `null` so the DB never stores
// "" as a sentinel for "no description". Drizzle's nullable text
// columns accept `null` directly.
function normaliseNullable(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
