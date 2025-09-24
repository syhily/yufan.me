import type { SongInfo } from '../resolver'

// https://github.com/Suxiaoqinx/Netease_url
const headers = {
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,ja;q=0.6,zh-TW;q=0.5',
  'cache-control': 'no-cache',
  'content-type': 'application/json',
  'cookie': 'hasSeenWelcome=true',
  'origin': 'https://wyapi.toubiec.cn',
  'pragma': 'no-cache',
  'priority': 'u=1, i',
  'referer': 'https://wyapi.toubiec.cn/',
  'sec-ch-ua': `"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"`,
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': `"macOS"`,
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
}

export async function getSongInfo(id: string): Promise<SongInfo> {
  try {
    const response = await fetch('https://wyapi.toubiec.cn/api/music/detail', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: `${id}` }),
    })
    const result = await response.json()
    const song = result?.data
    if (!song) {
      throw new Error(`Failed to get song ${id} info`)
    }
    return {
      name: song.name,
      artist: song.singer || '',
      pic: song.picimg || '',
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
    const response = await fetch('https://wyapi.toubiec.cn/api/music/url', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: `${id}`, level }),
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
    const response = await fetch('https://wyapi.toubiec.cn/api/music/lyric', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: `${id}` }),
    })
    const result = await response.json()

    if (result?.code !== 200) {
      console.error('Failed to get lyrics:', result?.message || 'Unknown error')
      return null
    }

    return result?.data?.lrc || result?.data?.klyric || result?.data?.tlyric
  }
  catch (error) {
    console.error('Failed to get lyrics:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}
