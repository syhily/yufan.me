import type { Post } from '@/services/catalog/schema'

import config from '@/blog.config'
import { Icon } from '@/components/icons/Icon'
import { Pagination } from '@/components/page/pagination/Pagination'
import { AstroImage } from '@/components/ui/AstroImage'
import { getCategory, getPostsWithMetadata } from '@/services/catalog/schema'
import { formatShowDate, slicePosts } from '@/services/markdown/formatter'

export interface PostCardsProps {
  posts: Post[]
  pageNum: number
}

// Callers are responsible for handling the empty-slice case before we get
// here (set `Astro.response.status = 404` / rewrite to `/404` from the page
// shell). This component renders the grid + pagination for a valid page.
export async function PostCards({ pageNum, posts }: PostCardsProps) {
  const { currentPosts, totalPage } = slicePosts(posts, pageNum, config.settings.pagination.posts)
  const resolvedPosts = await getPostsWithMetadata(currentPosts, {
    likes: true,
    views: true,
    comments: true,
  })

  const categoryLinks = new Map<string, string>()
  await Promise.all(
    resolvedPosts.map(async (post) => {
      if (categoryLinks.has(post.category)) return
      const cat = await getCategory(post.category, undefined)
      categoryLinks.set(post.category, cat?.permalink ?? '')
    }),
  )

  return (
    <div className="content-wrapper col-12 col-xl-9">
      <div className="list-grid">
        {resolvedPosts.map((post) => (
          <div key={post.slug} className="list-item block">
            <div className="media media-3x2 col-6 col-md-5">
              <a href={post.permalink} className="media-content">
                <AstroImage src={post.cover} alt={post.title} width={600} height={400} />
              </a>
              <div className="media-overlay overlay-top">
                <a
                  className="d-none d-md-inline-block badge badge-md bg-white-overlay"
                  href={categoryLinks.get(post.category) || ''}
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
