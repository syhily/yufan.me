import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { ImagesView } from '@/ui/admin/images/ImagesView'

import type { Route } from './+types/wp-admin.images'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '图片管理' }, bundleFromMatches(matches))
}

export default function WpAdminImagesRoute() {
  return <ImagesView />
}
