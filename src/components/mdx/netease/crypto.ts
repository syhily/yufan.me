import { Buffer } from 'node:buffer';
import * as crypto from 'node:crypto';

const eAPIKey = 'e82ckenh8dichen8';

const aesEncrypt = (buffer: Buffer, mode: string, key: Buffer | string, iv: Buffer | string) => {
  const cipher = crypto.createCipheriv('aes-128-' + mode, key, iv);
  return Buffer.concat([cipher.update(buffer), cipher.final()]);
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
