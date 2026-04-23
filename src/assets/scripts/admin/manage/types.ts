export interface AdminComment {
  id: string
  createAt: string
  updatedAt: string
  content: string
  pageKey: string
  pageTitle: string | null
  userId: string
  name: string
  email: string
  link: string | null
  badgeName: string | null
  badgeColor: string | null
  isPending: boolean
  isVerified: boolean
  ua: string | null
  ip: string | null
  rid: number
  rootId: string | null
}

export type FilterStatus = 'all' | 'pending' | 'approved'
