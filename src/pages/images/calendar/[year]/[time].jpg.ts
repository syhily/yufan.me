import type { APIRoute } from 'astro';

const loadCalendarImage = async (year: string, time: string): Promise<Response> => {
  const link = `https://img.owspace.com/Public/uploads/Download/${year}/${time}.jpg`;
  return await fetch(link, {
    referrer: '',
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
