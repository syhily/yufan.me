import fs from 'node:fs/promises';
import { join } from 'node:path';
import options from '../../options';
import { urlJoin } from './tools';

export interface Image {
  /**
   * public url of the image
   */
  src: string;
  /**
   * image width
   */
  width: number | string;
  /**
   * image height
   */
  height: number | string;
  /**
   * blurDataURL of the image
   */
  blurDataURL: string;
  /**
   * blur image width
   */
  blurWidth: number;
  /**
   * blur image height
   */
  blurHeight: number;
}

export const openGraphWidth = 1200;

export const openGraphHeight = 768;

// Copied and modified from https://github.com/vercel/next.js/blob/canary/packages/next/src/shared/lib/image-blur-svg.ts
const blurImage = ({ width, height, blurWidth, blurHeight, blurDataURL }: Image): string => {
  const std = 20;
  const svgWidth = blurWidth ? blurWidth * 40 : width;
  const svgHeight = blurHeight ? blurHeight * 40 : height;

  const viewBox = svgWidth && svgHeight ? `viewBox='0 0 ${svgWidth} ${svgHeight}'` : '';

  return `%3Csvg xmlns='http://www.w3.org/2000/svg' ${viewBox}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='${std}'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='${std}'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='xMidYMid slice' style='filter: url(%23b);' href='${blurDataURL}'/%3E%3C/svg%3E`;
};

export const blurStyle = (image: Image) => ({
  backgroundSize: 'cover',
  backgroundPosition: '50% 50%',
  backgroundRepeat: 'no-repeat',
  backgroundImage: `url("data:image/svg+xml;charset=utf-8,${blurImage({ ...image })}")`,
});

// Copied and modified https://github.com/zce/velite/blob/main/src/assets.ts
export const imageMetadata = async (publicPath: string): Promise<Image> => {
  const { default: sharp } = await import('sharp');

  if (!publicPath.startsWith('/')) {
    throw new Error('We only support image path in "public/images" directory. The path should start with "/images/".');
  }

  const root = join(process.cwd(), 'public');
  const buffer = await fs.readFile(join(root, publicPath));
  const img = sharp(buffer);
  const { width, height } = await img.metadata();
  if (typeof width === 'undefined' || typeof height === 'undefined') {
    throw new Error(`Invalid image path: ${publicPath}`);
  }
  const aspectRatio = width / height;
  const blurWidth = 8;
  const blurHeight = Math.round(blurWidth / aspectRatio);
  const blurImage = await img.resize(blurWidth, blurHeight).webp({ quality: 1 }).toBuffer();
  const blurDataURL = `data:image/webp;base64,${blurImage.toString('base64')}`;

  return { src: urlJoin(options.assetsPrefix(), publicPath), height, width, blurDataURL, blurWidth, blurHeight };
};
