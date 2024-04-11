'use client';
import 'artalk/dist/Artalk.css';

import Artalk from 'artalk';
import React, { ComponentProps, useEffect, useRef } from 'react';

import { options } from '#site/content';

export function ArtalkComment({ id, title }: Readonly<{ id: string; title: string } & ComponentProps<'div'>>) {
  const artalkInstanceRef = useRef<Artalk | null>(null);
  const containerRef = React.createRef<HTMLDivElement>();

  useEffect(() => {
    if (artalkInstanceRef.current) {
      return;
    }

    artalkInstanceRef.current = Artalk.init({
      el: containerRef.current!,
      pageKey: `${options.website}/${id}/`,
      pageTitle: title,
      server: options.settings.comments.server,
      site: options.title,
    });

    return () => {
      // I don't know why this can't be added.
      // artalkInstanceRef.current?.destroy();
    };
  }, [id, title, containerRef]);

  return (
    <div id="comments" className="comments py-5" ref={containerRef}>
      评价加载中...
    </div>
  );
}
