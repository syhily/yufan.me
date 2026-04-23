import type { Post } from '@/services/catalog/schema'

import { Icon } from '@/assets/icons/Icon'
import config from '@/blog.config'
import { QRDialog } from '@/components/partial/QRDialog'
import { joinUrl } from '@/shared/urls'

export interface LikeShareProps {
  post: Post
}

export function LikeShare({ post }: LikeShareProps) {
  const postURL = joinUrl(config.website, post.permalink)
  const qq = new URLSearchParams({
    url: postURL,
    pics: post.cover,
    summary: post.summary,
  }).toString()
  const weibo = new URLSearchParams({
    url: postURL,
    type: 'button',
    language: 'zh_cn',
    pic: post.cover,
    searchPic: 'true',
    title: `【${post.title}】${post.summary}`,
  }).toString()

  return (
    <div className="post-share text-center mt-4">
      <a
        href={`https://connect.qq.com/widget/shareqq/index.html?${qq}`}
        className="btn btn-light btn-icon btn-md btn-circle mx-1 qq"
        title="分享到 QQ 空间"
      >
        <span>
          <Icon name="qq" />
        </span>
      </a>
      <QRDialog
        url={postURL}
        name="在微信中请长按二维码"
        title="微信扫一扫 分享朋友圈"
        icon="wechat"
        className="btn btn-light btn-icon btn-circle btn-md single-popup mx-1"
      />
      <a
        href={`https://service.weibo.com/share/share.php?${weibo}`}
        className="btn btn-light btn-icon btn-circle btn-md mx-1 weibo"
        title="分享到微博"
      >
        <span>
          <Icon name="weibo" />
        </span>
      </a>
    </div>
  )
}
