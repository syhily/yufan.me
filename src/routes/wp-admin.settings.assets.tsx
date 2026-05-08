import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { AssetsForm, type AssetsLoaderShape } from '@/ui/admin/settings/AssetsForm'

import type { Route } from './+types/wp-admin.settings.assets'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '存储配置' }, bundleFromMatches(matches))
}

export default function WpAdminSettingsAssetsRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  // The layout loader's invariant guarantees `bundle.assets` is non-null
  // post-install. We project the slice here so the form receives the
  // shape it actually needs (masked secret, defaulted upload limits).
  const assets = bundle.assets
  const secretAccessKey = typeof assets.storage.secretAccessKey === 'string' ? assets.storage.secretAccessKey : ''
  const projection: AssetsLoaderShape = {
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
  return <AssetsForm assets={projection} />
}
