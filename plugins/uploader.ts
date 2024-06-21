import {
  HeadBucketCommand,
  HeadObjectCommand,
  NoSuchBucket,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { AstroIntegration, AstroIntegrationLogger } from 'astro';
import { z } from 'astro/zod';
import mime from 'mime';
import fs from 'node:fs';
import path from 'node:path';
import { rimrafSync } from 'rimraf';

const S3Options = z
  .object({
    // The directories that you want to upload to S3.
    paths: z.array(z.string()).min(1),
    // Whether to keep the original files after uploading.
    keep: z.boolean().default(false),
    // The S3 region, set it if you use AWS S3 service.
    region: z.string().min(1).default('auto'),
    // The endpoint, set it if you use 3rd-party S3 service.
    endpoint: z.string().url().optional(),
    // The name of the bucket.
    bucket: z.string().min(1),
    // The root directory you want to upload files.
    root: z.string().default('/'),
    // The access key id.
    accessKey: z.string().min(1),
    // The secret access key.
    secretAccessKey: z.string().min(1),
  })
  .strict()
  .superRefine((opts, { addIssue }) => {
    if (opts.region === 'auto' && opts.endpoint === undefined) {
      addIssue({ fatal: true, code: 'custom', message: 'either the region or the endpoint should be provided' });
    }
  });

const parseOptions = (opts: z.input<typeof S3Options>, logger: AstroIntegrationLogger): z.infer<typeof S3Options> => {
  try {
    return S3Options.parse(opts);
  } catch (err) {
    if (err instanceof z.ZodError) {
      logger.error(`Uploader options validation error, there are ${err.issues.length} errors:`);
      for (const issue of err.issues) {
        logger.error(issue.message);
      }
    }

    throw err;
  }
};

class Context {
  private client: S3Client;
  private bucket: string;
  private root: string;

  constructor(client: S3Client, bucket: string, root: string) {
    this.client = client;
    this.bucket = bucket;
    this.root = root;
  }

  async isExist(key: string): Promise<boolean> {
    const headCmd = new HeadObjectCommand({ Bucket: this.bucket, Key: path.posix.join(this.root, key) });
    try {
      await this.client.send(headCmd);
      return true;
    } catch (error) {
      if (error instanceof NotFound) {
        return false;
      }
      throw error;
    }
  }

  async write(key: string, body: Buffer) {
    const contentType = mime.getType(key);
    const putCmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: path.posix.join(this.root, key),
      Body: body,
      ContentType: contentType === null ? undefined : contentType,
    });

    await this.client.send(putCmd);
  }
}

export const uploader = (opts: z.input<typeof S3Options>): AstroIntegration => ({
  name: 'S3 Uploader',
  hooks: {
    'astro:build:done': async ({ dir, logger }: { dir: URL; logger: AstroIntegrationLogger }) => {
      const { paths, keep, region, endpoint, bucket, root, accessKey, secretAccessKey } = parseOptions(opts, logger);
      const client = new S3Client({
        region: region,
        endpoint: endpoint,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretAccessKey },
        useGlobalEndpoint: endpoint !== undefined && endpoint !== '',
      });

      logger.info('Try to verify the S3 credentials.');

      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch (err) {
        // If the bucket is not existed.
        if (err instanceof NoSuchBucket) {
          logger.error(`The bucket ${bucket} isn't existed on the region: ${region} endpoint: ${endpoint}`);
        } else {
          logger.error(JSON.stringify(err));
        }
        throw err;
      }

      logger.info(`Start to upload static files in dir ${paths} to S3 compatible backend.`);

      const context = new Context(client, bucket, root);
      for (const current of paths) {
        await uploadFile(context, logger, current, dir.pathname);
        if (!keep) {
          rimrafSync(path.join(dir.pathname, current));
        }
      }

      logger.info('Upload all the files successfully.');
    },
  },
});

// Change the windows path into the unix path.
const normalizePath = (current: string): string => {
  return current.includes(path.win32.sep) ? current.split(path.win32.sep).join(path.posix.sep) : current;
};

const uploadFile = async (context: Context, logger: AstroIntegrationLogger, current: string, root: string) => {
  const filePath = path.join(root, current);
  const isFile = !fs.statSync(filePath).isDirectory();
  const uploadAction = async (key: string) => {
    logger.info(`Start to upload file: ${key}`);
    const body = fs.readFileSync(filePath);
    await context.write(key, body);
  };

  if (isFile) {
    const key = normalizePath(current);
    if (await context.isExist(key)) {
      logger.info(`${key} exists on backend, skip.`);
    } else {
      await uploadAction(key);
    }
  } else {
    // Reclusive upload files.
    for (const next of fs.readdirSync(filePath)) {
      if (next.startsWith('.')) {
        continue;
      }
      await uploadFile(context, logger, path.join(current, next), root);
    }
  }
};
