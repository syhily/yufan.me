import type { SongInfo } from '../resolver'
import type { UserAgentType } from './config'
import { Buffer } from 'node:buffer'
import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { chineseIPs, neteaseAnonymousToken, userAgents } from './config'

const EAPI_KEY = 'e82ckenh8dichen8'

function chooseUserAgent(ua?: UserAgentType) {
  const agents
    = ua === undefined
      ? [...userAgents.mobile, ...userAgents.pc]
      : userAgents[ua]
  return agents[Math.floor(Math.random() * agents.length)]
}

function randomChineseIP() {
  return chineseIPs[Math.floor(Math.random() * chineseIPs.length)]
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
    const ip = randomChineseIP()
    const response = await fetch('https://interface3.music.163.com/eapi/v3/song/detail', {
      method: 'POST',
      headers: {
        'Referer': 'https://music.163.com/',
        'Origin': 'https://music.163.com',
        'Cookie': `MUSIC_A=${neteaseAnonymousToken}; appver=8.7.01; versioncode=140; buildver=${Date.now().toString().substring(0, 10)}; resolution=1920x1080; os=android; requestId=${Date.now()}_${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
        'X-Real-IP': ip,
        'X-Forwarded-For': ip,
        'User-Agent': chooseUserAgent(),
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
    const ip = randomChineseIP()
    const response = await fetch('https://interface.music.163.com/eapi/song/enhance/player/url/v1', {
      method: 'POST',
      headers: {
        'Referer': 'https://music.163.com/',
        'Origin': 'https://music.163.com',
        'Cookie': `MUSIC_A=${neteaseAnonymousToken}; appver=8.7.01; versioncode=140; buildver=${Date.now().toString().substring(0, 10)}; resolution=1920x1080; os=android; requestId=${Date.now()}_${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
        'X-Real-IP': ip,
        'X-Forwarded-For': ip,
        'User-Agent': chooseUserAgent(),
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
    const ip = randomChineseIP()
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Referer': 'https://music.163.com/',
        'Origin': 'https://music.163.com',
        'Cookie': `MUSIC_A=${neteaseAnonymousToken}; appver=8.7.01; versioncode=140; buildver=${Date.now().toString().substring(0, 10)}; resolution=1920x1080; os=android; requestId=${Date.now()}_${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
        'X-Real-IP': ip,
        'X-Forwarded-For': ip,
        'User-Agent': chooseUserAgent(),
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
