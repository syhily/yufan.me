import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  processAuthFormSubmission: vi.fn(),
}))

const state = vi.hoisted(() => {
  const store = new Map<string, unknown>()
  return {
    loggedIn: false,
    session: {
      get(key: string) {
        return store.get(key)
      },
      set(key: string, value: unknown) {
        store.set(key, value)
      },
      unset(key: string) {
        store.delete(key)
      },
    },
  }
})

vi.mock('@/server/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/session')>('@/server/session')
  return {
    ...actual,
    commitSession: vi.fn(async () => 'blog_session=stub'),
    destroySession: vi.fn(async () => 'blog_session=deleted'),
    getRouteRequestContext: vi.fn(({ request }: { request: Request }) => ({
      session: state.session,
      user: state.loggedIn ? { id: '1', name: 'admin', email: 'admin@yufan.me', admin: true } : undefined,
      admin: state.loggedIn,
      clientAddress: '127.0.0.1',
      url: new URL(request.url),
    })),
    processAuthFormSubmission: mocks.processAuthFormSubmission,
  }
})

const { action, loader } = await import('@/routes/wp-login')

beforeEach(() => {
  vi.clearAllMocks()
  state.loggedIn = false
  mocks.processAuthFormSubmission.mockResolvedValue({ ok: true })
})

async function catchResponse(promise: Promise<unknown>): Promise<Response> {
  try {
    await promise
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    throw error
  }
  throw new Error('Expected route to throw a Response')
}

describe('routes/wp-login', () => {
  it('sanitizes external logout redirect targets', async () => {
    const response = await catchResponse(
      loader({
        request: new Request('http://localhost/wp-login.php?action=logout&redirect_to=https://evil.example/phish'),
      } as never),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/')
  })

  it('sanitizes external already-logged-in redirect targets', async () => {
    state.loggedIn = true
    const response = await catchResponse(
      loader({
        request: new Request('http://localhost/wp-login.php?redirect_to=//evil.example/phish'),
      } as never),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/')
  })

  it('passes only a sanitized redirect target into login form handling', async () => {
    await action({
      request: new Request('http://localhost/wp-login.php?redirect_to=https://evil.example/phish', {
        method: 'POST',
        body: new FormData(),
      }),
    } as never)

    expect(mocks.processAuthFormSubmission).toHaveBeenCalledWith(expect.objectContaining({ redirectTo: '/' }))
  })
})
