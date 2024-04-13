import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import * as runtime from 'react/jsx-runtime';

import { NeteasePlayer } from '@/components/mdx/netease/player';

// @ts-ignore
async function MdxLink(props) {
  let href = props.href as string;

  if (href.startsWith('/')) {
    return (
      <Link href={href} {...props}>
        {props.children}
      </Link>
    );
  }

  if (href.startsWith('#')) {
    return <a {...props} />;
  }

  return <a target="_blank" rel="noopener noreferrer" {...props} />;
}

const sharedComponents = {
  a: MdxLink,
  Image: Image,
  NeteasePlayer: NeteasePlayer,
};

// parse the Velite generated MDX code into a React component function
const useMDXComponent = (code: string) => {
  const fn = new Function(code);
  return fn({ ...runtime }).default;
};

interface MDXProps {
  code: string;
  components?: Record<string, React.ComponentType>;
}

// MDXContent component
export const MDXContent = ({ code, components }: MDXProps) => {
  const Component = useMDXComponent(code);
  return <Component components={{ ...sharedComponents, ...components }} />;
};
