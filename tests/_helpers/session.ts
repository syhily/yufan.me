import type { BlogSession, BlogSessionData, SessionUser } from '@/server/session'

// In-memory `BlogSession` doppelganger. `react-router`'s real `Session`
// builds on top of `createSessionStorage`, which pulls Redis. Tests don't
// need that — they only need `.get` / `.set` / `.unset` semantics.
export function makeSession(data: Partial<BlogSessionData> = {}): BlogSession {
  const store = new Map<string, unknown>(Object.entries(data))
  const session = {
    id: 'test-session',
    data,
    has(key: string) {
      return store.has(key)
    },
    get(key: string) {
      return store.get(key)
    },
    set(key: string, value: unknown) {
      store.set(key, value)
    },
    unset(key: string) {
      store.delete(key)
    },
    flash() {
      // No-op: tests using flash messages should mock explicitly.
    },
  } as unknown as BlogSession
  return session
}

export function adminUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: '1',
    name: 'admin',
    email: 'admin@yufan.me',
    website: null,
    admin: true,
    ...overrides,
  }
}

export function regularUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: '2',
    name: 'reader',
    email: 'reader@example.com',
    website: null,
    admin: false,
    ...overrides,
  }
}

export function adminSession(): BlogSession {
  return makeSession({ user: adminUser() })
}

export function regularSession(): BlogSession {
  return makeSession({ user: regularUser() })
}

export function emptySession(): BlogSession {
  return makeSession({})
}
