/**
 * Generate the open graph.
 * It's highly inspired by the code from https://github.com/yuaanlin/yual.in/blob/main/pages/og_image/%5Bslug%5D.tsx
 * The original open source code don't have any license.
 * But I have get the approvement to use them here by asking the author https://twitter.com/yuaanlin.
 */
import { openGraphHeight, openGraphWidth } from '@/helpers/images';
import { options } from '@/helpers/schema';
import { Canvas, GlobalFonts, Image, type SKRSContext2D } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import font from '../asserts/og/NotoSansSC-Bold.ttf?arraybuffer';
import logoDark from '../asserts/og/logo-dark.png?arraybuffer';

const getStringWidth = (text: string, fontSize: number) => {
  let result = 0;
  for (let idx = 0; idx < text.length; idx++) {
    if (text.charCodeAt(idx) > 255) {
      result += fontSize;
    } else {
      result += fontSize * 0.5;
    }
  }
  return result;
};

// Print text on SKRSContext with wrapping
const printAt = (
  context: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  lineHeight: number,
  fitWidth: number,
  fontSize: number,
) => {
  // Avoid invalid fitWidth.
  const width = fitWidth || 0;

  if (width <= 0) {
    context.fillText(text, x, y);
    return;
  }

  for (let idx = 1; idx <= text.length; idx++) {
    const str = text.substring(0, idx);
    if (getStringWidth(str, fontSize) > width) {
      context.fillText(text.substring(0, idx - 1), x, y);
      printAt(context, text.substring(idx - 1), x, y + lineHeight, lineHeight, width, fontSize);
      return;
    }
  }
  context.fillText(text, x, y);
};

// Modified snippet from https://stackoverflow.com/questions/21961839/simulation-background-size-cover-in-canvas
const drawImageProp = (
  ctx: SKRSContext2D,
  img: Image,
  x: number,
  y: number,
  w: number,
  h: number,
  offsetX: number,
  offsetY: number,
) => {
  // keep bounds [0.0, 1.0]
  let ox = offsetX;
  if (offsetX < 0) ox = 0;
  if (offsetX > 1) ox = 1;
  let oy = offsetY;
  if (offsetY < 0) oy = 0;
  if (offsetY > 1) oy = 1;

  const iw = img.width;
  const ih = img.height;
  const r = Math.min(w / iw, h / ih);

  // new prop.width
  let nw = iw * r;
  // new prop.height
  let nh = ih * r;
  let ar = 1;

  // decide which gap to fill
  if (nw < w) ar = w / nw;
  if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh; // updated
  nw *= ar;
  nh *= ar;

  // calc source rectangle
  let cw = iw / (nw / w);
  let ch = ih / (nh / h);

  let cx = (iw - cw) * ox;
  let cy = (ih - ch) * oy;

  // make sure source rectangle is valid
  if (cx < 0) cx = 0;
  if (cy < 0) cy = 0;
  if (cw > iw) cw = iw;
  if (ch > ih) ch = ih;

  // fill image in dest. rectangle
  ctx.drawImage(img, cx, cy, cw, ch, x, y, w, h);
};

const fetchCover = async (cover: string): Promise<Buffer> => {
  if (cover.startsWith('http')) {
    return Buffer.from(await (await fetch(cover)).arrayBuffer());
  }

  const coverPath = join(process.cwd(), 'public', cover);
  return await readFile(coverPath);
};

export { default as defaultOpenGraph } from '../asserts/og/open-graph.png?arraybuffer';

export interface OpenGraphProps {
  title: string;
  summary: string;
  cover: string;
}

export const drawOpenGraph = async ({ title, summary, cover }: OpenGraphProps) => {
  // Register the font if it doesn't exist
  if (!GlobalFonts.has('NotoSansSC-Bold')) {
    const fontBuffer = Buffer.from(font);
    GlobalFonts.register(fontBuffer, 'NotoSansSC-Bold');
  }

  // Fetch the cover image as the background
  const coverImage = new Image();
  coverImage.src = await fetchCover(cover);

  // Generate the logo image
  const logoImage = new Image();
  logoImage.src = Buffer.from(logoDark);

  // Mark sure the summary length is small enough to fit in
  const description = `${summary
    .replace(/<[^>]+>/g, '')
    .slice(0, 80)
    .trim()} ...`;

  // Start drawing the open graph
  const canvas = new Canvas(openGraphWidth, openGraphHeight);
  const ctx = canvas.getContext('2d');
  drawImageProp(ctx, coverImage, 0, 0, openGraphWidth, openGraphHeight, 0.5, 0.5);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, openGraphWidth, openGraphHeight);
  ctx.save();

  // Add website title
  ctx.fillStyle = '#e0c2bb';
  ctx.font = '800 64px NotoSansSC-Bold';
  printAt(ctx, options.title, 96, 180, 96, openGraphWidth, 64);

  // Add website logo
  ctx.drawImage(logoImage, 940, 120, 160, 160);

  // Add article title
  ctx.fillStyle = '#fff';
  ctx.font = '800 48px NotoSansSC-Bold';
  printAt(ctx, title, 96, openGraphHeight / 2 - 64, 96, openGraphWidth - 192, 64);

  // Add article summary
  ctx.font = '800 36px NotoSansSC-Bold';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  printAt(ctx, description, 96, openGraphHeight - 200, 48, openGraphWidth - 192, 36);

  ctx.restore();

  return await canvas.encode('png');
};
