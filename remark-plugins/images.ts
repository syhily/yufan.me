import type { Literal, Node, Parent } from 'unist';
import { visit } from 'unist-util-visit';
import { imageMetadata } from '../src/helpers/images';

export type ImageNode = Parent & {
  url: string;
  alt: string;
  name: string;
  width?: number;
  height?: number;
  attributes: (Literal & { name: string })[];
};

export const astroImage = () => {
  return async (tree: Node) => {
    const images: ImageNode[] = [];

    // Find all the local image node.
    visit(tree, 'image', (node: Node, _, __: Parent) => {
      const imageNode = node as ImageNode;
      // Skip remote images.
      if (imageNode.url.startsWith('http')) {
        return;
      }

      images.push(imageNode);
    });

    // Process images.
    await Promise.all(images.map(transformAstroImage));
    return tree;
  };
};

const transformAstroImage = async (imageNode: ImageNode) => {
  const metadata = await imageMetadata(imageNode.url);
  if (metadata == null) {
    throw new Error(`Failed to get image metadata: ${imageNode.url}`);
  }

  // Convert original node to next/image
  imageNode.type = 'mdxJsxFlowElement';
  imageNode.name = 'Image';
  imageNode.attributes = [
    { type: 'mdxJsxAttribute', name: 'alt', value: imageNode.alt },
    { type: 'mdxJsxAttribute', name: 'src', value: imageNode.url },
    { type: 'mdxJsxAttribute', name: 'width', value: imageNode.width ?? metadata.width },
    { type: 'mdxJsxAttribute', name: 'height', value: imageNode.height ?? metadata.height },
    { type: 'mdxJsxAttribute', name: 'blurDataURL', value: metadata.blurDataURL },
    { type: 'mdxJsxAttribute', name: 'blurWidth', value: metadata.blurWidth },
    { type: 'mdxJsxAttribute', name: 'blurHeight', value: metadata.blurHeight },
  ];
};
