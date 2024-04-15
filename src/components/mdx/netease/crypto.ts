import { Buffer } from 'node:buffer';
import * as crypto from 'node:crypto';

const iv = Buffer.from('0102030405060708');
const presetKey = Buffer.from('0CoJUm6Qyw8W8jud');
const linuxAPIKey = Buffer.from('rFgB&h#%2?^eDg:Q');
const base62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const publicKey =
  '-----BEGIN PUBLIC KEY-----\n' +
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aK' +
  'zmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/' +
  'DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB\n' +
  '-----END PUBLIC KEY-----';
const eAPIKey = 'e82ckenh8dichen8';

const aesEncrypt = (buffer: Buffer, mode: string, key: Buffer | string, iv: Buffer | string) => {
  const cipher = crypto.createCipheriv('aes-128-' + mode, key, iv);
  return Buffer.concat([cipher.update(buffer), cipher.final()]);
};

const rsaEncrypt = (buffer: Buffer, key: string) => {
  buffer = Buffer.concat([Buffer.alloc(128 - buffer.length), buffer]);
  return crypto.publicEncrypt({ key: key, padding: crypto.constants.RSA_NO_PADDING }, buffer);
};

export const weAPI = (object: any) => {
  const text = JSON.stringify(object);
  const secretKey: Buffer = Buffer.from(crypto.randomBytes(16).map((n) => base62.charAt(n % 62).charCodeAt(0)));
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

export const linuxAPI = (object: any) => {
  const text = JSON.stringify(object);
  return {
    eparams: aesEncrypt(Buffer.from(text), 'ecb', linuxAPIKey, '').toString('hex').toUpperCase(),
  };
};

export const eAPI = (url: string, object: any) => {
  const text = typeof object === 'object' ? JSON.stringify(object) : object;
  const message = `nobody${url}use${text}md5forencrypt`;
  const digest = crypto.createHash('md5').update(message).digest('hex');
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
  return {
    params: aesEncrypt(Buffer.from(data), 'ecb', eAPIKey, '').toString('hex').toUpperCase(),
  };
};

export const decrypt = (cipherBuffer: Buffer) => {
  const decipher = crypto.createDecipheriv('aes-128-ecb', eAPIKey, '');
  return Buffer.concat([decipher.update(cipherBuffer), decipher.final()]);
};
