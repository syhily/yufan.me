import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { SiteIdentitySettings } from '@/shared/config/blog'

import { setBlogSettingsBundleForTests } from '@/server/domains/settings/snapshot'

import { TEST_BLOG_SETTINGS_BUNDLE } from './_helpers/blog-settings'

const warnSpy = vi.hoisted(() => vi.fn())

vi.mock('@/server/infra/logger', () => ({
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: warnSpy,
    error: vi.fn(),
    child: vi.fn(),
    withScope: vi.fn(),
  })),
}))

const { resolveAllowedActionOrigins, patchBuildAllowedOrigins } = await import('@/server')

describe('server / allowedActionOrigins', () => {
  beforeEach(() => {
    warnSpy.mockClear()
    setBlogSettingsBundleForTests(TEST_BLOG_SETTINGS_BUNDLE)
  })

  describe('resolveAllowedActionOrigins', () => {
    it('returns the database website host in production', () => {
      const original = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      const origins = resolveAllowedActionOrigins()
      process.env.NODE_ENV = original

      expect(origins).toEqual(['yufan.me'])
    })

    it('includes localhost and 127.0.0.1 in development', () => {
      const original = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      const origins = resolveAllowedActionOrigins()
      process.env.NODE_ENV = original

      expect(origins).toContain('localhost')
      expect(origins).toContain('127.0.0.1')
      expect(origins).toContain('yufan.me')
    })

    it('returns an empty array when no website is configured', () => {
      setBlogSettingsBundleForTests({
        ...TEST_BLOG_SETTINGS_BUNDLE,
        siteIdentity: { ...TEST_BLOG_SETTINGS_BUNDLE.siteIdentity, website: '' } as SiteIdentitySettings,
      })
      const original = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      const origins = resolveAllowedActionOrigins()
      process.env.NODE_ENV = original

      expect(origins).toEqual([])
    })

    it('ignores an invalid website URL', () => {
      setBlogSettingsBundleForTests({
        ...TEST_BLOG_SETTINGS_BUNDLE,
        siteIdentity: { ...TEST_BLOG_SETTINGS_BUNDLE.siteIdentity, website: 'not-a-url' } as SiteIdentitySettings,
      })
      const original = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      const origins = resolveAllowedActionOrigins()
      process.env.NODE_ENV = original

      expect(origins).toEqual([])
    })
  })

  describe('patchBuildAllowedOrigins', () => {
    it('does nothing when origins is empty', () => {
      const build: { allowedActionOrigins?: string[] } = {}
      patchBuildAllowedOrigins(build, [])
      expect(build.allowedActionOrigins).toBeUndefined()
    })

    it('assigns directly when the property is writable', () => {
      const build: { allowedActionOrigins?: string[] } = {}
      patchBuildAllowedOrigins(build, ['yufan.me'])
      expect(build.allowedActionOrigins).toEqual(['yufan.me'])
    })

    it('overrides a configurable getter-only property', () => {
      const build: { allowedActionOrigins?: string[] } = {}
      Object.defineProperty(build, 'allowedActionOrigins', {
        get() {
          return undefined
        },
        configurable: true,
        enumerable: true,
      })

      patchBuildAllowedOrigins(build, ['yufan.me'])
      expect(build.allowedActionOrigins).toEqual(['yufan.me'])
    })

    it('warns and skips when the property is non-configurable', () => {
      const build: { allowedActionOrigins?: string[] } = {}
      Object.defineProperty(build, 'allowedActionOrigins', {
        get() {
          return undefined
        },
        configurable: false,
        enumerable: true,
      })

      patchBuildAllowedOrigins(build, ['yufan.me'])
      expect(build.allowedActionOrigins).toBeUndefined()
      expect(warnSpy).toHaveBeenCalledWith(
        'build.allowedActionOrigins is read-only and non-configurable; skipping patch',
      )
    })

    it('warns and skips when assignment throws (e.g. read-only inherited prop)', () => {
      // In strict mode, assigning to a property that exists on the prototype
      // chain as non-writable throws, while getOwnPropertyDescriptor returns
      // undefined. This mirrors ESM module namespace object behaviour in builds.
      const proto = Object.defineProperty({}, 'allowedActionOrigins', {
        value: undefined,
        writable: false,
        configurable: false,
        enumerable: true,
      })
      const build = Object.create(proto) as { allowedActionOrigins?: string[] }

      patchBuildAllowedOrigins(build, ['yufan.me'])
      expect(build.allowedActionOrigins).toBeUndefined()
      expect(warnSpy).toHaveBeenCalledWith(
        'build.allowedActionOrigins is read-only and non-configurable; skipping patch',
      )
    })
  })
})
