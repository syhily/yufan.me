import { describe, expect, it } from 'vite-plus/test'

import { findLegacyRedirect } from '@/server/http/legacy-redirects'

describe('findLegacyRedirect', () => {
  it('maps a flat admin endpoint to its nested REST path', () => {
    expect(findLegacyRedirect('/api/actions/admin/listUsers')).toEqual({
      target: '/api/admin/users',
      status: 301,
    })
  })

  it('preserves the trailing parametric segment', () => {
    // Legacy callers used the same `/admin/listPosts` for both the
    // listing and per-id reads via different bodies. The newer REST
    // form uses `/admin/posts/:id`. The table only ships the prefix
    // case; tail-preserving entries (e.g. revisions) cover :id paths
    // via the prefix matcher.
    expect(findLegacyRedirect('/api/actions/admin/listPostRevisions/extra')).toEqual({
      target: '/api/admin/posts/revisions/extra',
      status: 301,
    })
  })

  it('returns null for an unknown legacy path', () => {
    expect(findLegacyRedirect('/api/actions/admin/somethingBrandNew')).toBeNull()
  })

  it('maps comment / public surfaces too', () => {
    expect(findLegacyRedirect('/api/actions/comment/comments')).toEqual({
      target: '/api/comment/comments',
      status: 301,
    })
    expect(findLegacyRedirect('/api/actions/music/get')).toEqual({
      target: '/api/music/get',
      status: 301,
    })
  })
})
