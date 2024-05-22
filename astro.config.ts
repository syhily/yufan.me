import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import robots from 'astro-robots-txt';
import { defineConfig } from 'astro/config';
import type { Literal, Node, Parent } from 'unist';
import { visit } from 'unist-util-visit';
import { imageMetadata } from './src/utils/images';

const site = import.meta.env.PROD ? 'https://yufan.me' : 'http://localhost:4321';

export type ImageNode = Parent & {
  url: string;
  alt: string;
  name: string;
  width?: number;
  height?: number;
  attributes: (Literal & { name: string })[];
};

export const lazyImage = () => {
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
  const metadata = await imageMetadata(imageNode.url);
  if (metadata == null) {
    throw new Error(`Failed to get image metadata: ${imageNode.url}`);
  }

  // Convert original node to lazy loading.
  imageNode.type = 'mdxJsxFlowElement';
  imageNode.name = 'img';
  imageNode.attributes = [
    { type: 'mdxJsxAttribute', name: 'alt', value: imageNode.alt },
    { type: 'mdxJsxAttribute', name: 'src', value: imageNode.url },
    { type: 'mdxJsxAttribute', name: 'width', value: imageNode.width ?? metadata.width },
    { type: 'mdxJsxAttribute', name: 'height', value: imageNode.height ?? metadata.height },
    { type: 'mdxJsxAttribute', name: 'loading', value: 'lazy' },
    {
      type: 'mdxJsxAttribute',
      name: 'style',
      value: `background-image: ${metadata.style.backgroundImage}; background-position: "${metadata.style.backgroundPosition}"; background-size: "${metadata.style.backgroundSize}"; background-repeat: "${metadata.style.backgroundRepeat}"`,
    },
  ];
};

// https://astro.build/config
export default defineConfig({
  site: site,
  output: 'hybrid',
  integrations: [sitemap(), robots({ sitemap: `${site}/sitemap-index.xml` }), mdx({ remarkPlugins: [lazyImage] })],
  adapter: node({
    mode: 'standalone',
  }),
  markdown: {
    gfm: true,
    shikiConfig: {
      theme: 'solarized-light',
      wrap: false,
    },
  },
});
