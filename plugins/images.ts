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

type MdxJsxAttribute = {
  type: 'mdxJsxAttribute';
  name: string;
  value: string;
};

type MdxJsxFlowElement = Parent & {
  name: string;
  attributes: MdxJsxAttribute[];
};

export const astroImage = () => {
  return async (tree: Node) => {
    // Find all the img node.
    const imgs = selectAll('mdxJsxFlowElement', tree)
      .map((node) => node as MdxJsxFlowElement)
      .filter((node) => node.name === 'img');
    for (const img of imgs) {
      const srcAttribute = img.attributes.find((attribute) => attribute.name === 'src');
      if (srcAttribute) {
        const src = srcAttribute.value;
        if (src.startsWith('/')) {
          srcAttribute.value = urlJoin(options.assetsPrefix(), src);
        }
      }
    }

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
