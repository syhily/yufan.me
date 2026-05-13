export const userSortOrders = ['recent', 'commentCount'] as const
export type UserSortOrder = (typeof userSortOrders)[number]

export interface ListUsersInput {
  offset?: number
  limit?: number
  q?: string
  role?: 'all' | 'admin' | 'author' | 'visitor' | 'normal'
  includeDeleted?: boolean | 'true' | 'false'
  sortBy?: UserSortOrder
  hasPosts?: boolean | 'true' | 'false'
}

export interface UserIdInput {
  userId: string
}

export interface MuteUserInput extends UserIdInput {
  muted: boolean | 'true' | 'false'
}

export interface AdminUserDto {
  id: string
  name: string
  email: string
  link: string | null
  badgeName: string | null
  badgeColor: string | null
  badgeTextColor: string | null
  role: 'admin' | 'author' | 'visitor' | null
  isMuted: boolean
  emailVerified: boolean
  createdAt: string
  deletedAt: string | null
  lastIp: string | null
  lastUa: string | null
  commentCount: number
  pendingCount: number
  lastCommentAt: string | null
}
