import type { Friend } from '@/server/catalog'

import { shuffle } from '@/shared/tools'
import { Card } from '@/ui/primitives/Card'
import { Heading } from '@/ui/primitives/Heading'
import { Image } from '@/ui/primitives/Image'
import { Media } from '@/ui/primitives/Media'
import { MediaCover } from '@/ui/primitives/MediaCover'

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
      <div className="flex h-[50vh] flex-1 flex-col text-center">
        <div className="my-auto">
          <div>还没有友链呢...😭</div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 md:px-0">
      <Heading level={2} className="text-foreground-muted mb-4 md:mb-3">
        左邻右舍 <span className="text-accent text-sm mb-4 md:mb-3">排名不分前后</span>
      </Heading>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        {list.map((friend) => (
          <div key={friend.website} className="flex">
            <Card className="flex-auto">
              <Media ratio="3x1">
                <MediaCover>
                  <Image
                    src={friend.poster}
                    alt={friend.website}
                    width={1280}
                    height={425}
                    thumbhash={friend.posterThumbhash}
                  />
                </MediaCover>
              </Media>
              <div className="flex flex-col flex-auto justify-center px-5 py-4">
                <div className="flex-auto">
                  <div className="line-clamp-1 block text-base font-semibold text-inherit">{friend.website}</div>
                  <div className="text-sm text-foreground-soft line-clamp-2 mt-1">
                    {friend.description ? friend.description : ' '}
                  </div>
                </div>
              </div>
              <a
                href={friend.homepage}
                target="_blank"
                rel="nofollow noreferrer"
                className="absolute inset-0 z-(--z-card-overlay-3)"
                aria-label={`访问 ${friend.website}`}
              />
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}
