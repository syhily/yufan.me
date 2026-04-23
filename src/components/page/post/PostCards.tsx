import type { PostWithMetadata } from '@/services/catalog/schema'

import { Icon } from '@/assets/icons/Icon'
import { Pagination } from '@/components/page/pagination/Pagination'
import { Image } from '@/components/partial/Image'
import { formatShowDate } from '@/services/markdown/formatter'

export interface PostCardsProps {
  posts: PostWithMetadata[]
  pageNum: number
  totalPage: number
  categoryLinks: Record<string, string>
}

export function PostCards({ pageNum, posts, totalPage, categoryLinks }: PostCardsProps) {
  return (
    <div className="content-wrapper col-12 col-xl-9">
      <div className="list-grid">
        {posts.map((post) => (
          <div key={post.slug} className="list-item block">
            <div className="media media-3x2 col-6 col-md-5">
              <a href={post.permalink} className="media-content">
                <Image src={post.cover} alt={post.title} width={600} height={400} />
              </a>
              <div className="media-overlay overlay-top">
                <a
                  className="d-none d-md-inline-block badge badge-md bg-white-overlay"
                  href={categoryLinks[post.category] || ''}
                >
                  {post.category}
                </a>
              </div>
            </div>
            <div className="list-content">
              <div className="list-body">
                <a href={post.permalink} className="list-title h5">
                  <div className="h-2x">
                    {!post.published && <span style={{ color: 'var(--color-danger)' }}>【草稿】</span>}
                    {post.title}
                  </div>
                </a>
                <div className="d-none d-md-block list-desc text-secondary text-md mt-3">
                  <div className="h-3x">{post.summary ?? ''}</div>
                </div>
              </div>
              <div className="list-footer">
                <div className="d-flex flex-fill align-items-center text-muted text-sm">
                  <div className="flex-fill d-none d-md-block">{formatShowDate(post.date)}</div>
                  <div className="list-like d-inline-block">
                    <Icon name="eye" className="text-md" />
                    <span className="like-count">{post.meta.views}</span>
                  </div>
                  <div className="list-like d-inline-block">
                    <Icon name="heart-fill" className="text-md" />
                    <span className="like-count">{post.meta.likes}</span>
                  </div>
                  <div className="list-like d-inline-block">
                    <Icon name="comment" className="text-md" />
                    <span className="like-count">{post.meta.comments}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Pagination current={pageNum} total={totalPage} rootPath="/" />
    </div>
  )
}
