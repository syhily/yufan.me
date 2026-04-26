import { describe, expect, it } from 'vite-plus/test'

import { commentBadgeTextColor, withCommentBadgeTextColor } from '@/server/comments/badge'

describe('services/comments/badge', () => {
  it('uses dark text for light badge backgrounds', () => {
    expect(commentBadgeTextColor('#6ab7ca')).toBe('#151b2b')
  })

  it('uses light text for dark badge backgrounds', () => {
    expect(commentBadgeTextColor('#172554')).toBe('#ffffff')
  })

  it('computes the text color only when a badge is present', () => {
    expect(withCommentBadgeTextColor({ badgeName: '站长', badgeColor: '#6ab7ca' }).badgeTextColor).toBe('#151b2b')
    expect(withCommentBadgeTextColor({ badgeName: null, badgeColor: '#6ab7ca' }).badgeTextColor).toBeNull()
  })
})
