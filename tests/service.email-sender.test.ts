import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// Email templates pull in `react-email` which expects a server runtime;
// stub them with trivial React components so the import chain is cheap
// and we can focus on the sender's transport / config branches.
vi.mock('@/server/email/templates/NewComment', () => ({
  default: () => null,
}))
vi.mock('@/server/email/templates/NewReply', () => ({
  default: () => null,
}))
vi.mock('@/server/email/templates/ApprovedComment', () => ({
  default: () => null,
}))
vi.mock('react-email', () => ({
  render: vi.fn(async () => '<p>stub</p>'),
}))
vi.mock('@/server/markdown/parser', () => ({
  parseContent: vi.fn(async (raw: string) => `<p>${raw}</p>`),
}))

const { DEFAULT_SETTINGS } = await import('@/server/settings/defaults')
const { setBlogSettingsSnapshotForTests } = await import('@/server/settings/snapshot')
const { sendNewComment, sendTestMail } = await import('@/server/email/sender')

interface MailFixture {
  enabled: boolean
  host: string
  apiKey: string
  sender: string
}

function setMail(mail: Partial<MailFixture>) {
  setBlogSettingsSnapshotForTests({
    ...DEFAULT_SETTINGS,
    settings: {
      ...DEFAULT_SETTINGS.settings,
      mail: { ...DEFAULT_SETTINGS.settings.mail, ...mail },
    },
  })
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  setBlogSettingsSnapshotForTests(undefined)
  vi.unstubAllGlobals()
})

describe('email/sender — internalSend (via sendNewComment)', () => {
  // Fixture row used by every comment-fired test below.
  const commentInfo = {
    id: 7n,
    content: 'hello',
    isPending: false,
    user: { id: 1n, name: 'visitor', email: 'visitor@example.com' },
  } as never
  const page = { key: 'https://example.com/posts/hi', title: 'Hi' } as never

  it('skips with reason=disabled when the master switch is off', async () => {
    setMail({ enabled: false, host: 'api.zeabur.com', apiKey: 'KEY', sender: 'noreply@example.com' })

    const result = await sendNewComment(commentInfo, page)

    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.reason).toBe('disabled')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('skips with reason=unconfigured when API key is empty even if enabled', async () => {
    setMail({ enabled: true, host: 'api.zeabur.com', apiKey: '', sender: 'noreply@example.com' })

    const result = await sendNewComment(commentInfo, page)

    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.reason).toBe('unconfigured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs to the configured Zeabur ZSend endpoint with the bearer token', async () => {
    setMail({ enabled: true, host: 'api.zeabur.com', apiKey: 'SECRET', sender: 'noreply@example.com' })
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

    const result = await sendNewComment(commentInfo, page)

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.zeabur.com/api/v1/zsend/emails')
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers.Authorization).toBe('Bearer SECRET')
    expect(headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(init?.body as string)
    expect(body.from).toBe('noreply@example.com')
    expect(body.to).toEqual([DEFAULT_SETTINGS.author.email])
  })

  it('reports upstream rejections through reason=upstream with the status code', async () => {
    setMail({ enabled: true, host: 'api.zeabur.com', apiKey: 'SECRET', sender: 'noreply@example.com' })
    fetchMock.mockResolvedValueOnce(new Response('quota exceeded', { status: 429, statusText: 'Too Many Requests' }))

    const result = await sendNewComment(commentInfo, page)

    expect(result.ok).toBe(false)
    if (result.ok === false && result.reason === 'upstream') {
      expect(result.status).toBe(429)
      expect(result.message).toContain('429')
      expect(result.message).toContain('quota exceeded')
    } else {
      throw new Error(`expected reason=upstream, got ${JSON.stringify(result)}`)
    }
  })

  it('reports network failures through reason=network', async () => {
    setMail({ enabled: true, host: 'api.zeabur.com', apiKey: 'SECRET', sender: 'noreply@example.com' })
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const result = await sendNewComment(commentInfo, page)

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.reason).toBe('network')
      if (result.reason === 'network') expect(result.message).toContain('ECONNREFUSED')
    }
  })
})

describe('email/sender — sendTestMail', () => {
  it('bypasses the enabled toggle so editors can verify before going live', async () => {
    setMail({ enabled: false, host: 'api.zeabur.com', apiKey: 'KEY', sender: 'noreply@example.com' })
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

    const result = await sendTestMail('me@example.com')

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init?.body as string)
    expect(body.to).toEqual(['me@example.com'])
    expect(body.subject).toContain(DEFAULT_SETTINGS.title)
  })

  it('still refuses to send when the configuration is incomplete', async () => {
    setMail({ enabled: true, host: 'api.zeabur.com', apiKey: '', sender: 'noreply@example.com' })

    const result = await sendTestMail('me@example.com')

    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.reason).toBe('unconfigured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces upstream errors with the original status', async () => {
    setMail({ enabled: true, host: 'api.zeabur.com', apiKey: 'SECRET', sender: 'noreply@example.com' })
    fetchMock.mockResolvedValueOnce(new Response('forbidden', { status: 403, statusText: 'Forbidden' }))

    const result = await sendTestMail('me@example.com')

    expect(result.ok).toBe(false)
    if (result.ok === false && result.reason === 'upstream') {
      expect(result.status).toBe(403)
    } else {
      throw new Error('expected reason=upstream')
    }
  })
})
