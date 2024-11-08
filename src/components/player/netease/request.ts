// The request is a rewritten file which is type safe to dispatch the netease music requests.
// We will try to use three types of requests here. The weapi, linuxapi and eapi.

import {
  chineseIPs,
  neteaseAnonymousToken,
  userAgents,
  type CryptoMethod,
  type HttpMethod,
  type UserAgentType,
} from '@/components/player/netease/config';
import { eapi, linuxapi, weapi } from '@/components/player/netease/encrypt';
import { customAlphabet } from 'nanoid/non-secure';

const nanoid = customAlphabet('1234567890abcdef', 32);

const chooseUserAgent = (ua?: UserAgentType) => {
  const agents = ua === undefined ? [...userAgents.mobile, ...userAgents.pc] : userAgents[ua];
  return agents[Math.floor(Math.random() * agents.length)];
};

const randomChineseIP = () => chineseIPs[Math.floor(Math.random() * chineseIPs.length)];

export type RequestOptions = {
  cookie?: Record<string, string | boolean | number>;
  ua?: UserAgentType;
  crypto: CryptoMethod;
  url?: string;
};

export const request = async (
  method: HttpMethod,
  url: string,
  form: Record<string, string>,
  options: RequestOptions,
) => {
  // Generate the fundamental request headers.
  const headers: Record<string, string> = { 'User-Agent': chooseUserAgent(options.ua) };
  const ip = randomChineseIP();
  headers['X-Real-IP'] = ip;
  headers['X-Forwarded-For'] = ip;
  if (method === 'POST' || method === 'PUT') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  if (url.includes('music.163.com')) {
    headers.Referer = 'https://music.163.com';
  }

  // Append cookies to header.
  let cookies = options.cookie ? options.cookie : {};
  cookies = {
    ...cookies,
    _remember_me: true,
    _ntes_nuid: nanoid(),
  };
  if (!cookies.MUSIC_U) {
    // This is a guest request.
    if (!cookies.MUSIC_A) {
      cookies.MUSIC_A = neteaseAnonymousToken;
    }
  }
  headers.Cookie = Object.keys(cookies)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(cookies[key])}`)
    .join('; ');

  // Try to choose encrypt method for generating the fetch request.
  let decryptedForm: Record<string, string>;
  let decryptedURL: string;

  if (options.crypto === 'weapi') {
    const csrfToken = (headers.Cookie || '').match(/_csrf=([^(;|$)]+)/);
    form.csrf_token = csrfToken ? csrfToken[1] : '';

    decryptedForm = weapi(form);
    decryptedURL = url.replace(/\w*api/, 'weapi');
  } else if (options.crypto === 'linuxapi') {
    headers['User-Agent'] =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36';

    decryptedForm = linuxapi(method, url, form);
    decryptedURL = 'https://music.163.com/api/linux/forward';
  } else if (options.crypto === 'eapi') {
    // Generate new cookies.
    const header: Record<string, string | boolean | number> = {
      osver: cookies.osver,
      deviceId: cookies.deviceId,
      appver: cookies.appver || '8.7.01',
      versioncode: cookies.versioncode || '140',
      mobilename: cookies.mobilename,
      buildver: cookies.buildver || Date.now().toString().substring(0, 10),
      resolution: cookies.resolution || '1920x1080',
      __csrf: cookies.__csrf || '',
      os: cookies.os || 'android',
      channel: cookies.channel,
      requestId: `${Date.now()}_${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(4, '0')} `,
      MUSIC_U: cookies.MUSIC_U,
      MUSIC_A: cookies.MUSIC_A,
    };
    headers.Cookie = Object.keys(header)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(header[key])}`)
      .join('; ');
    if (options.url === undefined) {
      throw new Error('eapi is required to have a url options.');
    }

    decryptedForm = eapi(options.url, form, header);
    decryptedURL = url.replace(/\w*api/, 'eapi');
  } else {
    throw new Error(`Unsupported crypto method ${options.crypto}`);
  }

  let settings: Record<string, string | Record<string, string>> = {
    method,
    headers,
    body: new URLSearchParams(decryptedForm).toString(),
  };

  if (options.crypto === 'eapi') {
    settings = {
      ...settings,
      responseType: 'arraybuffer',
    };
  }

  let res: Response;
  let count = 0;
  let result = {};
  do {
    res = await fetch(decryptedURL, settings);
    if (options.crypto === 'eapi') {
      const enc = new TextDecoder();
      result = JSON.parse(enc.decode(await res.arrayBuffer()));
    } else {
      result = await res.json();
    }
    count++;
    if (count > 1) {
      console.log(`Request ${count} times.`);
    }
    if (count > 5) {
      console.error('Max retries exceeded.');
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (res.status === -460);

  return result;
};
