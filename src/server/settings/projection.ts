import type { AssetsSettings, SearchSettings } from '@/shared/config/blog'
import type { AssetsLoaderShape, SearchLoaderShape } from '@/shared/config/settings'

/**
 * Project the raw `AssetsSettings` (from the settings bundle) into the
 * shape `<AssetsForm>` expects, with secret masking and defaulted upload
 * limits. Keeps the DTO assembly in the server layer so route components
 * only orchestrate — they never contain data-transformation logic.
 */
export function projectAssetsForAdmin(assets: AssetsSettings): AssetsLoaderShape {
  const secretAccessKey = typeof assets.storage.secretAccessKey === 'string' ? assets.storage.secretAccessKey : ''
  return {
    asset: { host: assets.asset.host, scheme: assets.asset.scheme },
    storage: {
      enabled: assets.storage.enabled === true,
      endpoint: assets.storage.endpoint ?? '',
      region: assets.storage.region ?? '',
      bucket: assets.storage.bucket ?? '',
      accessKeyId: assets.storage.accessKeyId ?? '',
      forcePathStyle: assets.storage.forcePathStyle === true,
      urlTemplate: assets.storage.urlTemplate ?? '',
    },
    secretAccessKeyMask: secretAccessKey === '' ? null : secretAccessKey.slice(-4),
    upload: {
      maxBytes: assets.upload.maxBytes ?? 8 * 1024 * 1024,
      jpegQuality: assets.upload.jpegQuality ?? 82,
    },
  }
}

/**
 * Project the raw `SearchSettings` (from the settings bundle) into the
 * shape `<SearchForm>` expects, with API key masking.
 */
export function projectSearchForAdmin(search: SearchSettings | undefined): SearchLoaderShape {
  const s = search ?? {
    search: {
      enabled: false,
      mode: 'like' as const,
      endpoint: '',
      apiKey: '',
      model: 'text-embedding-3-small',
      similarityThreshold: 0.5,
    },
  }
  const apiKey = typeof s.search.apiKey === 'string' ? s.search.apiKey : ''
  return {
    search: {
      enabled: s.search.enabled === true,
      mode: s.search.mode === 'vector' ? 'vector' : 'like',
      endpoint: s.search.endpoint ?? '',
      apiKey,
      model: s.search.model ?? 'text-embedding-3-small',
      similarityThreshold: s.search.similarityThreshold ?? 0.5,
    },
    apiKeyMask: apiKey === '' ? null : apiKey.slice(-4),
  }
}
