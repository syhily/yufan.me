import { DateTime } from 'luxon'

import type { Post } from '@/services/catalog/schema'

import config from '@/blog.config'
import { FeaturePost } from '@/components/page/post/FeaturePost'

export interface FeaturePostsProps {
  posts: Post[]
}

function cyrb53(str: string): number {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dailyFeaturePosts(posts: Post[]): Post[] {
  if (posts.length < 3) return posts

  const now = DateTime.now().setZone(config.settings.timeZone)
  const dateSeed = now.toFormat('yyyy-MM-dd')
  const rand = mulberry32(cyrb53(dateSeed))

  const withCover = posts.filter((p) => p.cover)
  const pool = withCover.length >= 3 ? withCover : posts
  if (pool.length < 3) return pool

  const shuffled = pool.slice()
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const selected = shuffled.slice(0, 3)
  return selected.sort((a, b) => +new Date(b.date) - +new Date(a.date))
}

export function FeaturePosts({ posts }: FeaturePostsProps) {
  const featurePosts = config.settings.post.feature ?? []
  const metas: Post[] =
    featurePosts.length < 3
      ? dailyFeaturePosts(posts)
      : featurePosts
          .map((slug) => posts.find((post) => post.slug === slug))
          .filter((post): post is Post => post !== undefined)
          .slice(0, 3)

  if (metas.length !== 3) return null
  return (
    <div className="list-top-pushes mb-3 mb-md-4 mb-lg-5">
      <div className="container">
        <div className="row gx-2 gx-md-3 list-grouped">
          <div className="col-lg-8">
            <FeaturePost post={metas[0]} />
          </div>
          <div className="col-lg-4 d-flex flex-column mt-2 mt-md-3 mt-lg-0">
            <div className="row g-2 g-md-3">
              <div className="col-6 col-lg-12">
                <FeaturePost post={metas[1]} />
              </div>
              <div className="col-6 col-lg-12">
                <FeaturePost post={metas[2]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
