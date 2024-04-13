import { Buffer } from 'node:buffer';

import { Canvas, GlobalFonts, loadImage, SKRSContext2D } from '@napi-rs/canvas';
import { NextRequest } from 'next/server';

import { options, Page, pages, Post, posts } from '#site/content';

type Article = Post | Page | null;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const slug = searchParams.get('slug');
  const post = posts.find((post) => post.slug === slug);
  if (post) {
    return generateImage(post);
  }

  const page = pages.find((page) => page.slug === slug);
  if (page) {
    return generateImage(page);
  }

  return generateImage(null);
}

async function generateImage(article: Article) {
  // Load Font for CJK characters. The bellowing line should be used in Vercel.
  const font = await fetch('https://yufan.me/fonts/PuHuiTi-ExtraBold.otf');
  // const font = fs.readFileSync(process.cwd() + '/public/fonts/PuHuiTi-ExtraBold.otf');
  GlobalFonts.register(Buffer.from(await font.arrayBuffer()), 'PuHuiTi-ExtraBold');

  // Generate cover.
  const coverImageUrl = options.website + (article === null ? '/images/default-cover.jpg' : article.cover.src);
  const coverImage = await loadImage(coverImageUrl);

  // Generate Content
  const title = article === null ? options.title : article.title;
  const content = article === null ? options.description : 'summary' in article ? article.summary : '';
  const description =
    content
      .replace(/<[^>]+>/g, '')
      .slice(0, 80)
      .trim() + ' ...';

  // Draw OG on canvas.
  const WIDTH = 1200;
  const HEIGHT = 768;
  const canvas = new Canvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  drawImageProp(ctx, coverImage, 0, 0, WIDTH, HEIGHT, 0.5, 0.5);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save();

  ctx.fillStyle = '#fff';
  ctx.font = '800 64px PuHuiTi-ExtraBold';
  printAt(ctx, '且听书吟', 96, 180, 96, WIDTH, 64);

  ctx.fillStyle = '#e0c2bb';
  printAt(ctx, title, 96, HEIGHT / 2 - 64, 96, WIDTH - 192, 64);
  ctx.font = '800 36px PuHuiTi-ExtraBold';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  printAt(ctx, description, 96, HEIGHT - 200, 48, WIDTH - 192, 36);
  ctx.restore();
  const buffer = await canvas.encode('png');

  return new ImageResp(buffer);
}

class ImageResp extends Response {
  public static displayName = 'ImageResponse';

  constructor(buffer: Buffer) {
    const { Readable } = require('stream');
    const stream = Readable.from(buffer);
    super(stream, {
      headers: {
        'content-type': 'image/png',
        'cache-control':
          process.env.NODE_ENV === 'development'
            ? 'no-cache, no-store'
            : 'public, immutable, no-transform, max-age=31536000',
      },
      status: 200,
    });
  }
}

function getStringWidth(text: string, fontSize: number) {
  let result = 0;
  for (let idx = 0; idx < text.length; idx++) {
    if (text.charCodeAt(idx) > 255) {
      result += fontSize;
    } else {
      result += fontSize * 0.5;
    }
  }
  return result;
}

/** print text on SKRSContext with wrapping */
function printAt(
  context: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  lineHeight: number,
  fitWidth: number,
  fontSize: number,
) {
  fitWidth = fitWidth || 0;

  if (fitWidth <= 0) {
    context.fillText(text, x, y);
    return;
  }

  for (let idx = 1; idx <= text.length; idx++) {
    const str = text.substring(0, idx);
    if (getStringWidth(str, fontSize) > fitWidth) {
      context.fillText(text.substring(0, idx - 1), x, y);
      printAt(context, text.substring(idx - 1), x, y + lineHeight, lineHeight, fitWidth, fontSize);
      return;
    }
  }
  context.fillText(text, x, y);
}

/**
 * https://stackoverflow.com/questions/21961839/simulation-background-size-cover-in-canvas
 **/
function drawImageProp(
  ctx: SKRSContext2D,
  img: any,
  x: number,
  y: number,
  w: number,
  h: number,
  offsetX: any,
  offsetY: any,
) {
  if (arguments.length === 2) {
    x = y = 0;
    w = ctx.canvas.width;
    h = ctx.canvas.height;
  }

  // default offset is center
  offsetX = typeof offsetX === 'number' ? offsetX : 0.5;
  offsetY = typeof offsetY === 'number' ? offsetY : 0.5;

  // keep bounds [0.0, 1.0]
  if (offsetX < 0) offsetX = 0;
  if (offsetY < 0) offsetY = 0;
  if (offsetX > 1) offsetX = 1;
  if (offsetY > 1) offsetY = 1;

  let iw = img.width,
    ih = img.height,
    r = Math.min(w / iw, h / ih),
    nw = iw * r, // new prop. width
    nh = ih * r, // new prop. height
    cx,
    cy,
    cw,
    ch,
    ar = 1;

  // decide which gap to fill
  if (nw < w) ar = w / nw;
  if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh; // updated
  nw *= ar;
  nh *= ar;

  // calc source rectangle
  cw = iw / (nw / w);
  ch = ih / (nh / h);

  cx = (iw - cw) * offsetX;
  cy = (ih - ch) * offsetY;

  // make sure source rectangle is valid
  if (cx < 0) cx = 0;
  if (cy < 0) cy = 0;
  if (cw > iw) cw = iw;
  if (ch > ih) ch = ih;

  // fill image in dest. rectangle
  ctx.drawImage(img, cx, cy, cw, ch, x, y, w, h);
}
