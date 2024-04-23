import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Literal, Node, Parent } from 'unist';
import { visit } from 'unist-util-visit';
import { getImageMetadata } from 'velite';

export type ImageNode = Parent & {
  url: string;
  alt: string;
  name: string;
  width?: number;
  height?: number;
  attributes: (Literal & { name: string })[];
};

export const nextImage = () => {
  return async (tree: Node) => {
    const images: ImageNode[] = [];

    // Find all the local image node.
    visit(tree, 'image', (node: Node, _, parent: Parent) => {
      const imageNode = node as ImageNode;
      // Skip remote images.
      if (imageNode.url.startsWith('http')) {
        return;
      }

      images.push(imageNode);
    });

    // Process images.
    await Promise.all(images.map(transformNextImage));
    return tree;
  };
};

const transformNextImage = async (imageNode: ImageNode) => {
  const path = join(process.cwd(), 'public', imageNode.url);
  const buffer = await readFile(path);
  let metadata = await getImageMetadata(buffer);
  if (metadata == null) {
    throw new Error(`Failed to get image metadata: ${path}`);
  }

  // Convert original node to next/image
  (imageNode.type = 'mdxJsxFlowElement'),
    (imageNode.name = 'Image'),
    (imageNode.attributes = [
      { type: 'mdxJsxAttribute', name: 'alt', value: imageNode.alt },
      { type: 'mdxJsxAttribute', name: 'src', value: imageNode.url },
      { type: 'mdxJsxAttribute', name: 'width', value: imageNode.width ?? metadata.width },
      { type: 'mdxJsxAttribute', name: 'height', value: imageNode.height ?? metadata.height },
      { type: 'mdxJsxAttribute', name: 'placeholder', value: 'blur' },
      { type: 'mdxJsxAttribute', name: 'blurDataURL', value: metadata.blurDataURL },
    ]);
};
