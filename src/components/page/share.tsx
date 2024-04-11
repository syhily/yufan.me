import { join } from 'node:path';
import * as querystring from 'node:querystring';

import Link from 'next/link';
import React from 'react';

import { QRDialog } from '@/components/qrcode/qrocode';
import { options, Post } from '#site/content';

export function Share({ post }: { post: Post }) {
  const postURL = join(options.website, post.permalink);
  const qq = querystring.stringify({
    query: `url=${postURL}&pics=${join(options.website, post.cover.src)}&summary=${post.summary ?? post.excerpt}`,
  });
  const weibo = querystring.stringify({
    query: `url=${postURL}&type=button&language=zh_cn&pic=${join(options.website, post.cover.src)}&searchPic=true&title=【${post.title}】${post.summary ?? post.excerpt}`,
  });

  return (
    <div className="post-share text-center mt-4">
      <Link
        href={`https://connect.qq.com/widget/shareqq/index.html?${qq}`}
        className="btn btn-light btn-icon btn-md btn-circle mx-1 qq "
      >
        <span>
          <i className="iconfont icon-QQ"></i>
        </span>
      </Link>
      <QRDialog
        url={postURL}
        name={'在微信中请长按二维码'}
        title={'微信扫一扫 分享朋友圈'}
        icon={'icon-wechat'}
        className={'btn btn-light btn-icon btn-circle btn-md single-popup mx-1 weixin'}
      />
      <Link
        href={`https://service.weibo.com/share/share.php?${weibo}`}
        className="btn btn-light btn-icon btn-circle btn-md mx-1 weibo "
      >
        <span>
          <i className="iconfont icon-weibo"></i>
        </span>
      </Link>
    </div>
  );
}
