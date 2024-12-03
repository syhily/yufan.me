import type { Literal, Node, Parent } from 'unist';
import { selectAll } from 'unist-util-select';
import options from '../options';
import { urlJoin } from '../src/helpers/tools';

type LinkNode = Node & {
  url: string;
  children?: ImageNode[];
};

type ImageNode = Parent & {
  url: string;
  alt: string;
  name: string;
  width?: number;
  height?: number;
  attributes: (Literal & { name: string })[];
};

export const astroImage = () => {
  return (tree: Node) => {
    // Find all the image node.
    // Find all the image link nodes and replace the relative links.
    selectAll('image', tree)
      .map((node) => node as ImageNode)
      .filter((imageNode) => imageNode.url.startsWith('/'))
      .map((imageNode) => {
        imageNode.type = 'mdxJsxFlowElement';
        imageNode.name = 'Image';

        imageNode.attributes = [
          { type: 'mdxJsxAttribute', name: 'alt', value: imageNode.alt },
          { type: 'mdxJsxAttribute', name: 'src', value: imageNode.url },
          { type: 'mdxJsxAttribute', name: 'width', value: imageNode.width },
          { type: 'mdxJsxAttribute', name: 'height', value: imageNode.height },
        ];
      });

    for (const node of selectAll('link', tree)) {
      const link = node as LinkNode;
      if (link.children !== undefined && link.children.length !== 0) {
        const images = link.children.filter((child) => child.type === 'mdxJsxFlowElement' && child.name === 'Image');
        if (images.length > 0) {
          link.url = link.url.startsWith('/') ? urlJoin(options.assetsPrefix(), link.url) : link.url;
        }
      }
    }
    return tree;
  };
};
