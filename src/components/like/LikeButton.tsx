import { Icon } from '@/components/icons/Icon'
import { queryLikes } from '@/services/comments/likes'

export interface LikeButtonProps {
  permalink: string
}

export async function LikeButton({ permalink }: LikeButtonProps) {
  const likes = await queryLikes(permalink)
  return (
    <div className="post-action text-center mt-5">
      <button
        className="post-like btn btn-secondary btn-lg btn-rounded"
        title="Do you like me?"
        type="button"
        data-permalink={permalink}
      >
        <Icon name="heart-fill" className="me-1" />
        <span className="like-count">{likes}</span>
      </button>
    </div>
  )
}
