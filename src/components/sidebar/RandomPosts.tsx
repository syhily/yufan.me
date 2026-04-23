import type { Post } from '@/services/catalog/schema'

import config from '@/blog.config'
import { sampleSize } from '@/shared/tools'

export interface RandomPostsProps {
  posts: Post[]
}

export function RandomPosts({ posts }: RandomPostsProps) {
  const randomSize = config.settings.sidebar.post
  if (randomSize <= 0) return null
  return (
    <div id="recent-posts" className="widget widget-recent-entries">
      <div className="widget-title" data-tippy-content="年年岁岁花相似，岁岁年年人不同。">
        流年拾忆
      </div>
      <ul className="line">
        {sampleSize(posts, randomSize).map((post) => (
          <li key={post.slug}>
            <a href={post.permalink} title={post.title}>
              {post.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
