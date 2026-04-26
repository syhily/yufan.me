import type { Friend } from '@/server/catalog'

import { shuffle } from '@/shared/tools'
import { Image } from '@/ui/primitives/Image'

export interface FriendsProps {
  friends: Friend[]
}

export function Friends({ friends }: FriendsProps) {
  const list = shuffle(
    [...friends],
    `friends:${friends.map((friend) => `${friend.website}:${friend.homepage}`).join('|')}`,
  )

  if (list.length === 0) {
    return (
      <div className="data-null">
        <div className="my-auto">
          <div>还没有友链呢...😭</div>
        </div>
      </div>
    )
  }

  return (
    <div className="list-bookmarks px-3 px-md-0">
      <h2 className="text-muted mb-4 mb-md-3">
        左邻右舍 <span className="text-primary text-sm mb-4 mb-md-3">排名不分前后</span>
      </h2>
      <div className="row g-3 g-md-4 list-grouped">
        {list.map((friend) => (
          <div key={friend.website} className="col-12 col-md-4">
            <div className="list-item block">
              <div className="media media-3x1">
                <div className="media-content">
                  <Image
                    src={friend.poster}
                    alt={friend.website}
                    width={1280}
                    height={425}
                    thumbhash={friend.posterThumbhash}
                  />
                </div>
              </div>
              <div className="list-content">
                <div className="list-body">
                  <div className="list-title h6 h-1x">{friend.website}</div>
                  <div className="text-sm text-secondary h-2x mt-1">
                    {friend.description ? friend.description : ' '}
                  </div>
                </div>
              </div>
              <a
                href={friend.homepage}
                target="_blank"
                rel="nofollow noreferrer"
                className="list-gogogo"
                aria-label={`访问 ${friend.website}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
