import { Buffer } from 'node:buffer'
import { createCipheriv, createHash, randomBytes } from 'node:crypto'

const EAPI_KEY = 'e82ckenh8dichen8'
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 CloudMusic/2.5.1',
  'Referer': 'https://music.163.com/',
  'Origin': 'https://music.163.com',
  'Cookie': `NMTID=00Oggc6B-vI6Pa0XEr-p56LdZyLvRMAAAGZRGOh2A; _ntes_nuid=${randomBytes(16).toString('hex')}`,
}

function aesEncrypt(buffer: Buffer | string, mode: string, key: string, iv: string) {
  const keyBuffer = Buffer.from(key).subarray(0, 16)
  const ivBuffer = Buffer.from(iv).subarray(0, 16)
  const cipher = createCipheriv(`aes-128-${mode}`, keyBuffer, ivBuffer)
  cipher.setAutoPadding(true)
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  return Buffer.concat([cipher.update(data), cipher.final()])
}

function eapi(url: string, obj: any) {
  const text = JSON.stringify(obj)
  const message = `nobody${url}use${text}md5forencrypt`
  const digest = createHash('md5').update(message).digest('hex')
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
  return {
    params: aesEncrypt(data, 'ecb', EAPI_KEY, '').toString('hex').toUpperCase(),
  }
}

export interface Song {
  id: string
  name: string
  artists?: Array<{
    name: string
  }>
  album?: {
    name: string
    picUrl?: string
  }
  duration?: number
  publishTime?: number
}

function toFormUrlEncoded(obj: Record<string, string>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

export async function getSongInfo(id: string): Promise<Song> {
  try {
    const url = '/api/v3/song/detail'
    const data = {
      c: JSON.stringify([{ id }]),
      header: {
        os: 'iOS',
        appver: '2.5.1',
        deviceId: randomBytes(8).toString('hex').toUpperCase(),
      },
    }

    const { params } = eapi(url, data)
    const response = await fetch('https://interface3.music.163.com/eapi/v3/song/detail', {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'NeteaseMusic/2.5.1 (iPhone; iOS 16.6; Scale/3.00)',
      },
      body: toFormUrlEncoded({ params }),
    })

    const result = await response.json()
    const song = result?.songs?.[0]
    if (!song) {
      throw new Error(`Failed to get song ${id} info`)
    }

    const artists = song.ar?.map((artist: any) => ({
      name: artist.name || 'Unknown Artist',
    })) || [{ name: 'Unknown Artist' }]

    return {
      id: song.id.toString(),
      name: song.name,
      artists,
      album: {
        name: song.al?.name || '',
        picUrl: song.al?.picUrl,
      },
      duration: song.dt,
      publishTime: song.publishTime,
    }
  }
  catch (error) {
    console.error(
      'Failed to get song info:',
      error instanceof Error ? error.message : 'Unknown error',
    )
    throw error
  }
}

export async function getSongUrl(id: string, level: string): Promise<string | null> {
  try {
    const url = '/api/song/enhance/player/url/v1'
    const data = {
      ids: [id],
      level,
      encodeType: 'aac',
      header: {
        os: 'iOS',
        appver: '2.5.1',
        deviceId: randomBytes(8).toString('hex').toUpperCase(),
      },
    }

    const { params } = eapi(url, data)
    const response = await fetch('https://interface.music.163.com/eapi/song/enhance/player/url/v1', {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'NeteaseMusic/2.5.1 (iPhone; iOS 16.6; Scale/3.00)',
      },
      body: toFormUrlEncoded({ params }),
    })
    const result = await response.json()
    if (result?.code !== 200) {
      console.error(`API returned error for ${level}:`, {
        code: result?.code,
        message: result?.message,
        data: result,
      })
      return null
    }

    const songData = result?.data?.[0]
    if (!songData?.url) {
      console.warn(`Couldn't get ${level} quality URL`)
      return null
    }
    return songData.url
  }
  catch (error) {
    console.error(
      `Failed to get ${level} quality:`,
      error instanceof Error ? error.message : 'Unknown error',
    )
    return null
  }
}

export async function getLyrics(id: string): Promise<string | null> {
  try {
    const url = '/api/song/lyric/v1'
    const data = {
      id,
      lv: 1,
      kv: 1,
      tv: -1,
      header: {
        os: 'iOS',
        appver: '2.5.1',
        deviceId: randomBytes(8).toString('hex').toUpperCase(),
      },
    }

    const { params } = eapi(url, data)
    const apiUrl = 'https://interface3.music.163.com/eapi/song/lyric/v1'
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'NeteaseMusic/2.5.1 (iPhone; iOS 16.6; Scale/3.00)',
      },
      body: toFormUrlEncoded({ params }),
    })
    const result = await response.json()

    if (result?.code !== 200) {
      console.error('Failed to get lyrics:', result?.message || 'Unknown error')
      return null
    }

    return result?.lrc?.lyric
  }
  catch (error) {
    console.error('Failed to get lyrics:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}
