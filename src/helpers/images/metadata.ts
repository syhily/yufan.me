import type { Image } from '@/helpers/images/types';
import fs from 'node:fs/promises';
import { join } from 'node:path';

// Copied and modified https://github.com/zce/velite/blob/main/src/assets.ts
export const imageMetadata = async (publicPath: string): Promise<Image> => {
  // Load for sharp on demand for avoiding the resolver issues in production.
  const { default: sharp } = await import('sharp');

  if (!publicPath.startsWith('/')) {
    throw new Error('We only support image path in public direct. It should start with "/".');
  }

  const root = join(process.cwd(), 'public');
  const buffer = await fs.readFile(join(root, publicPath));
  const img = sharp(buffer);
  const { width, height } = await img.metadata();
  if (width == null || height == null) {
    throw new Error(`Invalid image path: ${publicPath}`);
  }
  const aspectRatio = width / height;
  const blurWidth = 8;
  const blurHeight = Math.round(blurWidth / aspectRatio);
  const blurImage = await img.resize(blurWidth, blurHeight).webp({ quality: 1 }).toBuffer();
  const blurDataURL = `data:image/webp;base64,${blurImage.toString('base64')}`;

  return { src: publicPath, height, width, blurDataURL, blurWidth, blurHeight };
};
