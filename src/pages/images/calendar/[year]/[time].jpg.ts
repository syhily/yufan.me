import type { APIRoute } from 'astro';
import sharp from 'sharp';

const loadCalendarImage = async (year: string, time: string): Promise<Response> => {
  const link = `https://img.owspace.com/Public/uploads/Download/${year}/${time}.jpg`;
  const response = await fetch(link, {
    referrer: '',
  });

  if (!response.ok) {
    console.error(`Failed to fetch image ${link}`);
    return response;
  }

  const croppedImage = await sharp(await response.arrayBuffer())
    .extract({ width: 1096, height: 1550, left: 90, top: 110 })
    .toBuffer();

  return new Response(croppedImage, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=604800',
    },
  });
};

const timeRegex = /\d{4}/;

export const GET: APIRoute = async ({ params, redirect }) => {
  const { year, time } = params;
  if (year === undefined || !timeRegex.test(year) || time === undefined || !timeRegex.test(time)) {
    return redirect('/404');
  }

  return loadCalendarImage(year, time);
};
