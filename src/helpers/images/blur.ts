import type { Image } from '@/helpers/images/types';

// Copied and modified from https://github.com/vercel/next.js/blob/canary/packages/next/src/shared/lib/image-blur-svg.ts
const blurImage = ({ width, height, blurWidth, blurHeight, blurDataURL }: Image): string => {
  const std = 20;
  const svgWidth = blurWidth ? blurWidth * 40 : width;
  const svgHeight = blurHeight ? blurHeight * 40 : height;

  const viewBox = svgWidth && svgHeight ? `viewBox='0 0 ${svgWidth} ${svgHeight}'` : '';

  return `%3Csvg xmlns='http://www.w3.org/2000/svg' ${viewBox}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='${std}'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='${std}'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='xMidYMid slice' style='filter: url(%23b);' href='${blurDataURL}'/%3E%3C/svg%3E`;
};

export const blurStyle = (options: Image) => ({
  backgroundSize: 'cover',
  backgroundPosition: '50% 50%',
  backgroundRepeat: 'no-repeat',
  backgroundImage: `url("data:image/svg+xml;charset=utf-8,${blurImage({ ...options })}")`,
});
