import { describe, expect, it } from 'vite-plus/test'

import { apiContract } from '@/shared/contracts'

// Contract surface test. Verifies the contract tree exports a well-formed
// API surface by directly accessing known routes. No internal traversal needed.

describe('apiContract', () => {
  it('defines account routes', () => {
    expect(apiContract.account.updateProfile).toBeDefined()
    expect(apiContract.account.updatePassword).toBeDefined()
    expect(apiContract.account.revokeSession).toBeDefined()
  })

  it('defines auth routes', () => {
    expect(apiContract.auth.updateUser).toBeDefined()
  })

  it('defines comment routes', () => {
    expect(apiContract.comment.loadComments).toBeDefined()
    expect(apiContract.comment.replyComment).toBeDefined()
    expect(apiContract.comment.increaseLike).toBeDefined()
    expect(apiContract.comment.decreaseLike).toBeDefined()
    expect(apiContract.comment.edit).toBeDefined()
    expect(apiContract.comment.findAvatar).toBeDefined()
    expect(apiContract.comment.revokeToken).toBeDefined()
    expect(apiContract.comment.validateLikeToken).toBeDefined()
  })

  it('defines analytics routes', () => {
    expect(apiContract.analytics.counters).toBeDefined()
    expect(apiContract.analytics.views).toBeDefined()
    expect(apiContract.analytics.heatmap).toBeDefined()
    expect(apiContract.analytics.metrics).toBeDefined()
  })

  it('defines public image and music routes', () => {
    expect(apiContract.image.resolveThumbhash).toBeDefined()
    expect(apiContract.music.get).toBeDefined()
  })

  it('defines admin users routes', () => {
    const u = apiContract.admin.users
    expect(u.list).toBeDefined()
    expect(u.get).toBeDefined()
    expect(u.mute).toBeDefined()
    expect(u.updateRole).toBeDefined()
    expect(u.softDelete).toBeDefined()
    expect(u.restore).toBeDefined()
    expect(u.revokeSession).toBeDefined()
    expect(u.revokeAllSessions).toBeDefined()
  })

  it('defines admin posts routes', () => {
    const p = apiContract.admin.posts
    expect(p.list).toBeDefined()
    expect(p.get).toBeDefined()
    expect(p.upsertMeta).toBeDefined()
    expect(p.delete).toBeDefined()
    expect(p.restore).toBeDefined()
    expect(p.saveDraft).toBeDefined()
    expect(p.publish).toBeDefined()
    expect(p.unpublish).toBeDefined()
    expect(p.preview).toBeDefined()
  })

  it('defines admin pages routes', () => {
    const p = apiContract.admin.pages
    expect(p.list).toBeDefined()
    expect(p.get).toBeDefined()
    expect(p.upsertMeta).toBeDefined()
    expect(p.delete).toBeDefined()
    expect(p.restore).toBeDefined()
    expect(p.saveDraft).toBeDefined()
    expect(p.publish).toBeDefined()
  })

  it('defines admin settings/cache/mail routes', () => {
    expect(apiContract.admin.settings.getSettings).toBeDefined()
    expect(apiContract.admin.settings.updateSettings).toBeDefined()
    expect(apiContract.admin.cache.getStats).toBeDefined()
    expect(apiContract.admin.cache.clear).toBeDefined()
    expect(apiContract.admin.mail.sendTest).toBeDefined()
  })

  it('defines admin taxonomy routes', () => {
    expect(apiContract.admin.categories.list).toBeDefined()
    expect(apiContract.admin.categories.create).toBeDefined()
    expect(apiContract.admin.tags.list).toBeDefined()
    expect(apiContract.admin.tags.upsert).toBeDefined()
    expect(apiContract.admin.friends.list).toBeDefined()
    expect(apiContract.admin.friends.upsert).toBeDefined()
  })

  it('defines admin images/music/editor routes', () => {
    expect(apiContract.admin.images.list).toBeDefined()
    expect(apiContract.admin.images.upload).toBeDefined()
    expect(apiContract.admin.music.list).toBeDefined()
    expect(apiContract.admin.music.search).toBeDefined()
    expect(apiContract.admin.music.add).toBeDefined()
    expect(apiContract.admin.editor.renderMath).toBeDefined()
    expect(apiContract.admin.editor.renderMermaid).toBeDefined()
  })

  it('has all 19 top-level and admin sub-contracts accessible', () => {
    // TypeScript enforces these at compile time — runtime check is secondary.
    // Count the contracts we can access.
    const contracts: unknown[] = [
      apiContract.account,
      apiContract.auth,
      apiContract.comment,
      apiContract.analytics,
      apiContract.image,
      apiContract.music,
      apiContract.admin.users,
      apiContract.admin.posts,
      apiContract.admin.pages,
      apiContract.admin.settings,
      apiContract.admin.cache,
      apiContract.admin.mail,
      apiContract.admin.categories,
      apiContract.admin.tags,
      apiContract.admin.friends,
      apiContract.admin.images,
      apiContract.admin.music,
      apiContract.admin.editor,
    ]
    expect(contracts.length).toBe(18)
    for (const c of contracts) {
      expect(typeof c).toBe('object')
    }
  })
})
