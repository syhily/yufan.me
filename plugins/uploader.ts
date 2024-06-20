import { HeadObjectCommand, NotFound, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Logger } from '@smithy/types';
import type { AstroIntegration, AstroIntegrationLogger } from 'astro';
import { z } from 'astro/zod';
import fs from 'node:fs';
import path from 'node:path';

const S3Options = z.object({
  paths: z.array(z.string()).min(1),
  region: z.string().min(1).default('us-east-1'),
  endpoint: z.string().url().optional(),
  bucket: z.string().min(1),
  accessKey: z.string().min(1),
  secretAccessKey: z.string().min(1),
});

export const uploader = (opts: z.input<typeof S3Options>): AstroIntegration => ({
  name: 'S3 Uploader',
  hooks: {
    'astro:build:done': async ({ dir, logger }: { dir: URL; logger: AstroIntegrationLogger }) => {
      const { paths, bucket, accessKey, secretAccessKey, region, endpoint } = S3Options.parse(opts);

      // Create S3 Client.
      const clientLogger = (): Logger => {
        const s3Logger = logger.fork('S3 Client');
        return {
          // biome-ignore lint/suspicious/noExplicitAny: It's define by external types.
          debug: (...content: any[]): void => {
            s3Logger.debug(content.join(' '));
          },
          // biome-ignore lint/suspicious/noExplicitAny: It's define by external types.
          info: (...content: any[]): void => {
            s3Logger.info(content.join(' '));
          },
          // biome-ignore lint/suspicious/noExplicitAny: It's define by external types.
          warn: (...content: any[]): void => {
            s3Logger.warn(content.join(' '));
          },
          // biome-ignore lint/suspicious/noExplicitAny: It's define by external types.
          error: (...content: any[]): void => {
            s3Logger.error(content.join(' '));
          },
        };
      };
      const client = new S3Client({
        region: region,
        endpoint: endpoint,
        logger: clientLogger(),
        credentials: { accessKeyId: accessKey, secretAccessKey: secretAccessKey },
        useGlobalEndpoint: endpoint === '' || endpoint === '',
      });

      logger.info(`Start to upload static files in dir ${paths} to S3 compatible backend.`);

      for (const current of paths) {
        await uploadFile(client, logger, bucket, current, dir.pathname);
      }

      logger.info('Upload all the files successfully.');
    },
  },
});

// Change the windows path into the unix path.
const normalizePath = (current: string): string => {
  return current.includes(path.win32.sep) ? current.split(path.win32.sep).join(path.posix.sep) : current;
};

const uploadFile = async (
  client: S3Client,
  logger: AstroIntegrationLogger,
  bucket: string,
  current: string,
  root: string,
) => {
  const filePath = path.join(root, current);
  const isFile = !fs.statSync(filePath).isDirectory();

  if (isFile) {
    const key = normalizePath(current);
    const headCmd = new HeadObjectCommand({ Bucket: bucket, Key: key });
    try {
      await client.send(headCmd);
      logger.info(`${key} exists on backend, skip.`);
    } catch (error) {
      if (error instanceof NotFound) {
        logger.info(`Start to upload file: ${key}`);

        const body = fs.readFileSync(filePath);
        const putCmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body });
        await client.send(putCmd);
      } else {
        throw error;
      }
    }
    return;
  }

  // Reclusive upload files.
  for (const next of fs.readdirSync(filePath)) {
    if (next.startsWith('.')) {
      continue;
    }
    await uploadFile(client, logger, bucket, path.join(current, next), root);
  }
};
