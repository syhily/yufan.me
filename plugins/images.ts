import type { Literal, Node, Parent } from 'unist';
import { selectAll } from 'unist-util-select';
import options from '../options';
import { imageMetadata } from '../src/helpers/images';
import { urlJoin } from '../src/helpers/tools';

type ImageNode = Parent & {
  url: string;
  alt: string;
  name: string;
  width?: number;
  height?: number;
  attributes: (Literal & { name: string })[];
};

export const astroImage = () => {
  return async (tree: Node) => {
    // Find all the image node.
    const imageNodes = selectAll('image', tree)
      .map((node) => node as ImageNode)
      .filter((imageNode) => !imageNode.url.startsWith('http'))
      .map(transformAstroImage);

    // Process image with blur metadata.
    await Promise.all(imageNodes);
    return tree;
  };
};

const transformAstroImage = async (imageNode: ImageNode) => {
  imageNode.type = 'mdxJsxFlowElement';
  imageNode.name = 'Image';

  try {
    const metadata = await imageMetadata(imageNode.url);
    if (metadata == null) {
      throw new Error(`Failed to get image metadata: ${imageNode.url}`);
    }

    imageNode.attributes = [
      { type: 'mdxJsxAttribute', name: 'alt', value: imageNode.alt },
      { type: 'mdxJsxAttribute', name: 'src', value: metadata.src },
      { type: 'mdxJsxAttribute', name: 'width', value: imageNode.width ?? metadata.width },
      { type: 'mdxJsxAttribute', name: 'height', value: imageNode.height ?? metadata.height },
      { type: 'mdxJsxAttribute', name: 'blurDataURL', value: metadata.blurDataURL },
      { type: 'mdxJsxAttribute', name: 'blurWidth', value: metadata.blurWidth },
      { type: 'mdxJsxAttribute', name: 'blurHeight', value: metadata.blurHeight },
    ];
  } catch (error) {
    imageNode.attributes = [
      { type: 'mdxJsxAttribute', name: 'alt', value: imageNode.alt },
      {
        type: 'mdxJsxAttribute',
        name: 'src',
        value: imageNode.url.startsWith('/') ? urlJoin(options.assetsPrefix(), imageNode.url) : imageNode.url,
      },
    ];
  }
};
