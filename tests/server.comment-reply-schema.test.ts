import { describe, expect, it } from 'vite-plus/test'

import { commentReplySchema } from '@/server/comments/schema'

describe('commentReplySchema anti-spam', () => {
  const base = {
    page_key: '/posts/hello',
    name: 'Reader',
    email: 'reader@example.com',
    content: 'Thoughtful comment without links.',
    csrf: 'csrf-token-value',
    subtitle: '',
  }

  it('accepts a valid payload', async () => {
    const data = await commentReplySchema.parseAsync(base)
    expect(data.content).toBe(base.content)
    expect(data.subtitle).toBe('')
  })

  it('rejects a filled honeypot field', async () => {
    await expect(commentReplySchema.parseAsync({ ...base, subtitle: 'https://spam.example/' })).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ path: ['subtitle'] })]),
    })
  })

  it('rejects content with too many http(s) URLs', async () => {
    const content = Array.from({ length: 6 }, (_, i) => `https://spam${i}.example/`).join(' ')
    await expect(commentReplySchema.parseAsync({ ...base, content })).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ path: ['content'] })]),
    })
  })

  it('treats missing subtitle like empty for form submissions', async () => {
    const data = await commentReplySchema.parseAsync({
      page_key: base.page_key,
      name: base.name,
      email: base.email,
      content: base.content,
      csrf: base.csrf,
    })
    expect(data.subtitle).toBe('')
  })
})
