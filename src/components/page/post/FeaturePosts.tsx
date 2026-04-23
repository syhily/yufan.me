import type { Post } from '@/services/catalog/schema'

import config from '@/blog.config'
import { FeaturePost } from '@/components/page/post/FeaturePost'
import { shuffle } from '@/shared/tools'

export interface FeaturePostsProps {
  posts: Post[]
  seed: string
}

function dailyFeaturePosts(posts: Post[], seed: string): Post[] {
  if (posts.length < 3) return posts

  const withCover = posts.filter((p) => p.cover)
  const pool = withCover.length >= 3 ? withCover : posts
  if (pool.length < 3) return pool

  const selected = shuffle(pool, `feature-posts:${seed}:${pool.map((post) => post.slug).join('|')}`).slice(0, 3)
  return selected.sort((a, b) => +new Date(b.date) - +new Date(a.date))
}

export function FeaturePosts({ posts, seed }: FeaturePostsProps) {
  const featurePosts = config.settings.post.feature ?? []
  const metas: Post[] =
    featurePosts.length < 3
      ? dailyFeaturePosts(posts, seed)
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
