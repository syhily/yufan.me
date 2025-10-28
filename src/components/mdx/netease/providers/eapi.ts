import type { SongInfo } from '../resolver'
import { Buffer } from 'node:buffer'
import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { generateUserAgents } from '@rahulxf/random-user-agent'
import { getRandomChineseIp } from './ip'

// An request token which is decoded from the Netease Android Player.
const neteaseAnonymousToken = 'de91e1f8119d32e01cc73efcb82c0a30c9137e8d4f88dbf5e3d7bf3f28998f21add2bc8204eeee5e56c0bbb8743574b46ca2c10c35dc172199bef9bf4d60ecdeab066bb4dc737d1c3324751bcc9aaf44c3061cd18d77b7a0'

const EAPI_KEY = 'e82ckenh8dichen8'

function aesEncrypt(buffer: Buffer | string, mode: string, key: string, iv: string) {
  const keyBuffer = Buffer.from(key).subarray(0, 16)
  // For ECB mode Node's crypto expects a null IV. Passing an empty/short buffer
  // causes internal errors (AESCipherJob.onDone OperationError). Use null for
  // ECB and a 16-byte buffer for other modes.
  const ivBuffer = mode.toLowerCase() === 'ecb'
    ? null
    : Buffer.from(iv || '').subarray(0, 16)
  const cipher = createCipheriv(`aes-128-${mode}`, keyBuffer, ivBuffer as any)
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

function toFormUrlEncoded(obj: Record<string, string>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

export async function getSongInfo(id: string): Promise<SongInfo> {
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
    const ip = getRandomChineseIp()
    const response = await fetch('https://interface3.music.163.com/eapi/v3/song/detail', {
      method: 'POST',
      headers: {
        'Referer': 'https://music.163.com/',
        'Origin': 'https://music.163.com',
        'Cookie': `MUSIC_A=${neteaseAnonymousToken}; appver=8.7.01; versioncode=140; buildver=${Date.now().toString().substring(0, 10)}; resolution=1920x1080; os=android; requestId=${Date.now()}_${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
        'X-Real-IP': ip,
        'X-Forwarded-For': ip,
        'User-Agent': generateUserAgents(1)[0],
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: toFormUrlEncoded({ params }),
    })

    const result = await response.json()
    const song = result?.songs?.[0]
    if (!song) {
      throw new Error(`Failed to get song ${id} info`)
    }

    const artists = song.ar?.map((artist: any) => ({
      name: artist.name || '',
    }))

    return {
      name: song.name,
      artist: artists !== undefined ? artists[0].name : '',
      pic: song.al?.picUrl || '',
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
    const ip = getRandomChineseIp()
    const response = await fetch('https://interface.music.163.com/eapi/song/enhance/player/url/v1', {
      method: 'POST',
      headers: {
        'Referer': 'https://music.163.com/',
        'Origin': 'https://music.163.com',
        'Cookie': `MUSIC_A=${neteaseAnonymousToken}; appver=8.7.01; versioncode=140; buildver=${Date.now().toString().substring(0, 10)}; resolution=1920x1080; os=android; requestId=${Date.now()}_${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
        'X-Real-IP': ip,
        'X-Forwarded-For': ip,
        'User-Agent': generateUserAgents(1)[0],
        'Content-Type': 'application/x-www-form-urlencoded',
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
      console.warn(`Couldn't get ${level} quality URL for song ID ${id}`)
      return null
    }
    return songData.url.replace('http://', 'https://')
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
    const ip = getRandomChineseIp()
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Referer': 'https://music.163.com/',
        'Origin': 'https://music.163.com',
        'Cookie': `MUSIC_A=${neteaseAnonymousToken}; appver=8.7.01; versioncode=140; buildver=${Date.now().toString().substring(0, 10)}; resolution=1920x1080; os=android; requestId=${Date.now()}_${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
        'X-Real-IP': ip,
        'X-Forwarded-For': ip,
        'User-Agent': generateUserAgents(1)[0],
        'Content-Type': 'application/x-www-form-urlencoded',
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
