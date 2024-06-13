import _ from 'lodash';
import Image from 'next/image';
import React, { ComponentProps } from 'react';

import { Friend, friends } from '#site/content';

export function FriendLinks(props: ComponentProps<'div'>) {
  const list = _.shuffle(friends).map((friend) => <FriendCard key={friend.website} {...friend} />);

  return (
    <>
      {list.length > 0 ? (
        <div className="list-bookmarks px-3 px-md-0">
          <h2 className="text-muted mb-4 mb-md-3">
            左邻右舍 <span className="text-primary text-sm mb-4 mb-md-3">排名不分前后</span>
          </h2>
          <div className="row g-md-4 list-grouped">{list}</div>
        </div>
      ) : (
        <div className="data-null">
          <div className="my-auto">
            <div>还没有友链呢...😭</div>
          </div>
        </div>
      )}
    </>
  );
}

function FriendCard({ website, description, homepage, poster, favicon }: Friend) {
  return (
    <div className="col-12 col-md-4" key={website}>
      <div className="list-item block">
        <div className="media media-3x1">
          <div
            className="media-content"
            style={{
              backgroundImage: `url('${poster.src}')`,
              backgroundSize: 'cover',
            }}
          ></div>
        </div>
        <div className="list-content">
          <div className="list-body">
            <div className="list-title h6 h-1x">
              {website}
              <div
                className="list-favicon"
                style={{
                  backgroundImage: `url('${favicon}')`,
                }}
              ></div>
            </div>
            <div className="text-sm text-secondary h-2x mt-1">{description ? description : ' '}</div>
          </div>
        </div>
        <a href={homepage} target="_blank" className="list-gogogo"></a>
      </div>
    </div>
  );
}
