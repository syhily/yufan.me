import { Image } from '@/components/partial/Image'
import { FRIENDS } from '@/services/catalog/static'
import { shuffle } from '@/shared/tools'

export function Friends() {
  const list = shuffle([...FRIENDS])

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
                  <Image src={friend.poster} alt={friend.website} width={1280} height={425} />
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
              <a href={friend.homepage} target="_blank" className="list-gogogo" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
