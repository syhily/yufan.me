import fs from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'astro:content';
import { encode } from 'blurhash';
import sharp from 'sharp';

export interface Image {
  /**
   * relative image path in 'public' directory
   */
  src: string;
  /**
   * image width
   */
  width: number;
  /**
   * image height
   */
  height: number;
  /**
   * blur image in base64 encoding
   */
  blurHash: string;
}

export const image = (fallbackImage: string) =>
  z
    .string()
    .optional()
    .default(fallbackImage)
    .transform(async (arg) => await imageMetadata(arg));

export const imageMetadata = async (publicPath: string): Promise<Image> => {
  const root = join(process.cwd(), 'public');
  const file = await fs.readFile(join(root, publicPath));
  const img = sharp(file);
  const { width, height } = await img.metadata();
  if (width == null || height == null) {
    throw new Error(`Invalid image ${publicPath}`);
  }
  const aspectRatio = width / height;
  const blurWidth = 32;
  const blurHeight = Math.round(blurWidth / aspectRatio);

  const blurImage = await img.resize(blurWidth, blurHeight).webp({ quality: 1 }).toBuffer();
  console.log('ff');
  return {
    src: publicPath,
    width: width,
    height: height,
    blurHash: encode(Uint8ClampedArray.from(blurImage), blurWidth, blurHeight, 4, 4),
  };
};
