'use client';
import 'artalk/dist/ArtalkLite.css';

import Artalk from 'artalk/dist/ArtalkLite';
import React, { ComponentProps, useEffect, useRef } from 'react';

import { options } from '#site/content';

export function ArtalkComment({
  permalink,
  title,
}: Readonly<{ permalink: string; title: string } & ComponentProps<'div'>>) {
  const artalkInstanceRef = useRef<Artalk | null>(null);
  const containerRef = React.createRef<HTMLDivElement>();

  useEffect(() => {
    if (artalkInstanceRef.current) {
      return;
    }

    artalkInstanceRef.current = Artalk.init({
      el: containerRef.current!,
      pageKey: permalink,
      pageTitle: title,
      server: options.settings.comments.server,
      site: options.title,
    });

    return () => {
      // I don't know why this can't be added.
      // artalkInstanceRef.current?.destroy();
    };
  }, [permalink, title, containerRef]);

  return <div id="comments" className="comments py-5" ref={containerRef}></div>;
}
