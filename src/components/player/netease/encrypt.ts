import type { HttpMethod } from '@/components/player/netease/config';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';

const iv = Buffer.from('0102030405060708');
const presetKey = Buffer.from('0CoJUm6Qyw8W8jud');
const linuxapiKey = Buffer.from('rFgB&h#%2?^eDg:Q');
const base62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const publicKey =
  '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB\n-----END PUBLIC KEY-----';
const eapiKey = 'e82ckenh8dichen8';

const aesEncrypt = (
  buffer: Buffer | Uint8Array,
  mode: string,
  key: Buffer | Uint8Array | string,
  iv: Buffer | string,
) => {
  const cipher = crypto.createCipheriv(`aes-128-${mode}`, key, iv);
  return Buffer.concat([cipher.update(buffer), cipher.final()]);
};

const rsaEncrypt = (buffer: Buffer | Uint8Array, key: string) => {
  return crypto.publicEncrypt(
    { key: key, padding: crypto.constants.RSA_NO_PADDING },
    Buffer.concat([Buffer.alloc(128 - buffer.length), buffer]),
  );
};

export const weapi = (form: Record<string, string>): Record<string, string> => {
  const text = JSON.stringify(form);
  const secretKey = crypto.randomBytes(16).map((n) => base62.charAt(n % 62).charCodeAt(0));

  return {
    params: aesEncrypt(
      Buffer.from(aesEncrypt(Buffer.from(text), 'cbc', presetKey, iv).toString('base64')),
      'cbc',
      secretKey,
      iv,
    ).toString('base64'),
    encSecKey: rsaEncrypt(secretKey.reverse(), publicKey).toString('hex'),
  };
};

export const linuxapi = (method: HttpMethod, url: string, form: Record<string, string>): Record<string, string> => {
  const request = {
    method: method,
    url: url.replace(/\w*api/, 'api'),
    params: form,
  };

  const text = JSON.stringify(request);
  return {
    eparams: aesEncrypt(Buffer.from(text), 'ecb', linuxapiKey, '').toString('hex').toUpperCase(),
  };
};

export const eapi = (
  url: string,
  form: Record<string, string>,
  header: Record<string, string | boolean | number>,
): Record<string, string> => {
  const request = {
    ...form,
    header: header,
  };

  const text = JSON.stringify(request);
  const message = `nobody${url}use${text}md5forencrypt`;
  const digest = crypto.createHash('md5').update(message).digest('hex');
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
  return {
    params: aesEncrypt(Buffer.from(data), 'ecb', eapiKey, '').toString('hex').toUpperCase(),
  };
};
