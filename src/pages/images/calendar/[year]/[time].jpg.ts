import type { APIRoute } from 'astro'
import { Buffer } from 'node:buffer'
import { cacheBuffer, loadBuffer } from '@/helpers/cache'

async function loadCalendarImage(year: string, time: string): Promise<Response> {
  const link = `https://img.owspace.com/Public/uploads/Download/${year}/${time}.jpg`
  const cacheKey = `calendar-${year}-${time}`
  const buffer = await loadBuffer(cacheKey)

  if (buffer === null) {
    const resp = await fetch(link, { referrer: '' })
    if (resp.status < 300 && resp.status >= 200) {
      cacheBuffer(cacheKey, Buffer.from(await resp.arrayBuffer()), 60 * 60 * 24)
    }
    return resp
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=604800',
    },
  })
}

const timeRegex = /\d{4}/

export const GET: APIRoute = async ({ params, redirect }) => {
  const { year, time } = params
  if (year === undefined || !timeRegex.test(year) || time === undefined || !timeRegex.test(time)) {
    return redirect('/404')
  }

  return loadCalendarImage(year, time)
}
