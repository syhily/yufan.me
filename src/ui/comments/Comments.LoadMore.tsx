import { useRef } from 'react'
import { flushSync } from 'react-dom'

import type { LoadCommentsInput, LoadCommentsStreamLine } from '@/client/api/action-types'

import { API_ACTIONS } from '@/client/api/actions'
import { useApiStream } from '@/client/api/stream'
import { useCommentsActions, useCommentsMeta, useCommentsState } from '@/ui/comments/comments-context'
import { Button } from '@/ui/primitives/Button'
import { useSiteConfig } from '@/ui/primitives/site-config'

// "Load more" pagination button + NDJSON streamer.
//
// Each NDJSON line dispatches into the reducer wrapped in `flushSync` so
// roots paint top-down without waiting for the whole page to resolve. The
// reducer would otherwise be batched into a single render by React 19's
// automatic batching and the streaming UX would be lost.
export function CommentsLoadMore() {
  const meta = useCommentsMeta('Comments.LoadMore')
  const actions = useCommentsActions()
  const state = useCommentsState()
  const { settings } = useSiteConfig()
  const pageSize = settings.comments.size

  // The dispatch reference is plucked into a ref so the streaming
  // callback identity stays stable across renders.
  const dispatchRef = useRef(actions.dispatch)
  dispatchRef.current = actions.dispatch

  const loadMore = useApiStream<LoadCommentsInput, LoadCommentsStreamLine>(API_ACTIONS.comment.loadComments, {
    onLine: (line) => {
      if (line.type === 'meta') {
        flushSync(() => dispatchRef.current({ type: 'setRootsTotal', rootsTotal: line.roots_count }))
        return
      }
      if (line.type === 'item') {
        flushSync(() => dispatchRef.current({ type: 'appendOne', comment: line.comment }))
      }
    },
  })

  if (state === null || state.rootsLoaded >= state.rootsTotal) {
    return null
  }

  const moreLoading = loadMore.isPending
  const onLoadMore = () => {
    if (loadMore.isPending) {
      return
    }
    loadMore.load({
      page_key: meta.commentKey,
      offset: state.rootsLoaded,
    } satisfies LoadCommentsInput)
  }

  return (
    <div className="text-center mt-3 md:mt-4">
      <Button
        tone="neutral"
        onClick={onLoadMore}
        disabled={moreLoading}
        data-key={meta.commentKey}
        data-size={pageSize}
        data-offset={state.rootsLoaded}
      >
        {moreLoading ? '加载中...' : '加载更多'}
      </Button>
    </div>
  )
}
