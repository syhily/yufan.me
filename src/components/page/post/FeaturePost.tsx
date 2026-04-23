import type { Post } from '@/services/catalog/schema'

import { AstroImage } from '@/components/ui/AstroImage'

export interface FeaturePostProps {
  post: Post
}

export async function FeaturePost({ post }: FeaturePostProps) {
  return (
    <div className="list-item list-nice-overlay">
      <div className="media media-3x2">
        <a href={post.permalink} className="media-content">
          <AstroImage src={post.cover} alt={post.title} width={750} height={500} />
          <div className="overlay" />
        </a>
      </div>
      <div className="list-content p-2 p-md-3">
        <div className="list-body">
          <a href={post.permalink} className="list-title h5 h-2x m-0">
            {post.title}
          </a>
        </div>
      </div>
    </div>
  )
}
