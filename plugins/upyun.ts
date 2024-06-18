import type { AstroIntegration, AstroIntegrationLogger, RouteData } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import up from 'upyun';

export type UpyunOption = {
  path: string[];
  bucket?: string;
  operator?: string;
  password?: string;
};

const defaultOption: UpyunOption = {
  path: ['images'],
  bucket: process.env.UPYUN_BUCKET,
  operator: process.env.UPYUN_OPERATOR,
  password: process.env.UPYUN_PASSWORD,
};

export const upyun = (opt: UpyunOption): AstroIntegration => ({
  name: 'upyun',
  hooks: {
    'astro:build:done': async ({ dir, logger }: { dir: URL; routes: RouteData[]; logger: AstroIntegrationLogger }) => {
      const option: UpyunOption = { ...defaultOption, ...opt };
      if (typeof option.bucket === 'undefined' || opt.bucket === null) {
        logger.error('No "bucket" found on your configuration, skip deploying.');
        return;
      }
      if (typeof option.operator === 'undefined' || opt.operator === null) {
        logger.error('No "operator" found on your configuration, skip deploying.');
        return;
      }
      if (typeof option.password === 'undefined' || opt.password === null) {
        logger.error('No "password" found on your configuration, skip deploying.');
        return;
      }
      if (option.path.length === 0) {
        logger.warn('No files need to be upload to upyun. Skip.');
        return;
      }

      // Create UPYUN Client
      const service = new up.Service(option.bucket, option.operator, option.password);
      const client = new up.Client(service);

      // Upload one by one
      const staticRootPath = dir.pathname;
      for (const dir of option.path) {
        logger.info(`Start to upload the ${dir} to upyun`);
        await uploadFile(logger, client, staticRootPath, dir);
      }
    },
  },
});

const normalizePath = (p: string): string => {
  return p.includes(path.win32.sep) ? p.split(path.win32.sep).join(path.posix.sep) : p;
};

const uploadFile = async (logger: AstroIntegrationLogger, client: up.Client, root: string, current: string) => {
  const fullPath = path.join(root, current);
  const isDir = fs.statSync(fullPath).isDirectory();

  // Visit file.
  if (!isDir) {
    const filePath = normalizePath(current);
    const res1 = await client.headFile(filePath);

    if (res1 === false) {
      // This file need to be uploaded to upyun.
      // Try Create directory first.
      const newDir = filePath.substring(0, filePath.lastIndexOf(path.posix.sep));
      const res2 = await client.headFile(newDir);
      if (res2 === false) {
        logger.info(`Try to create ${newDir} on upyun`);
        await client.makeDir(newDir);
      }
      // Upload file.
      logger.info(`Try to upload file ${filePath} to upyun`);
      await client.putFile(filePath, fs.readFileSync(fullPath));
    }

    return;
  }

  for (const item of fs.readdirSync(fullPath)) {
    await uploadFile(logger, client, root, path.join(current, item));
  }
};
