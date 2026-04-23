import type { PostWithMetadata } from '@/services/catalog/schema'

import { Icon } from '@/components/icons/Icon'
import { AstroImage } from '@/components/ui/AstroImage'
import { formatShowDate } from '@/services/markdown/formatter'

export interface PostSquareProps {
  post: PostWithMetadata
  first: boolean
}

export async function PostSquare({ post, first }: PostSquareProps) {
  return (
    <div className={first ? 'col-12 col-md-8 col-xl-6' : 'col-6 col-md-4 col-xl-3'}>
      <div className="list-item list-nice-overlay">
        <div className={`media ${first ? 'media-36x17' : ''}`}>
          <a href={post.permalink} className="media-content">
            <AstroImage src={post.cover} alt={post.title} width={first ? 600 : 300} height={300} />
            <div className="overlay" />
          </a>
        </div>
        <div className="list-content">
          <a href={post.permalink} className="list-body">
            <div className="list-title h6 h-2x">{post.title}</div>
            <div className="list-meta font-number d-flex flex-fill text-muted text-sm">
              <span className="d-inline-block">{formatShowDate(post.date)}</span>
              <div className="flex-fill" />
              <div className="list-like-square d-inline-block">
                <Icon name="eye" className="text-md" />
                <span className="like-count">{post.meta.views}</span>
              </div>
              <div className="list-like-square d-inline-block">
                <Icon name="heart-fill" className="text-md" />
                <span className="like-count">{post.meta.likes}</span>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
