import {
  DeleteObjectCommand,
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
    // Whether to override the existing files on S3.
    // It will be override only when the content-length don't match the file size by default.
    override: z.boolean().default(false),
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

class Uploader {
  private client: S3Client;
  private options: z.infer<typeof S3Options>;

  constructor(client: S3Client, options: z.infer<typeof S3Options>) {
    this.client = client;
    this.options = options;
  }

  private key(key: string): string {
    return path.posix.join(this.options.root, key);
  }

  private async delete(key: string): Promise<void> {
    const deleteCmd = new DeleteObjectCommand({ Bucket: this.options.bucket, Key: this.key(key) });
    await this.client.send(deleteCmd);
  }

  async isExist(key: string, size: number): Promise<boolean> {
    const headCmd = new HeadObjectCommand({ Bucket: this.options.bucket, Key: this.key(key) });
    try {
      const { ContentLength } = await this.client.send(headCmd);
      // The file checksum should be uploaded with file. So we only check content length here.
      if (this.options.override || (ContentLength !== undefined && ContentLength !== size)) {
        await this.delete(key);
        return false;
      }
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
      Bucket: this.options.bucket,
      Key: this.key(key),
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
      const options = parseOptions(opts, logger);
      const { paths, keep, region, endpoint, bucket, accessKey, secretAccessKey } = options;
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

      const uploader = new Uploader(client, options);
      for (const current of paths) {
        await uploadFile(uploader, logger, current, dir.pathname);
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

const uploadFile = async (uploader: Uploader, logger: AstroIntegrationLogger, current: string, root: string) => {
  const filePath = path.join(root, current);
  const fileStats = fs.statSync(filePath);
  const isFile = !fileStats.isDirectory();
  const uploadAction = async (key: string) => {
    logger.info(`Start to upload file: ${key}`);
    const body = fs.readFileSync(filePath);
    await uploader.write(key, body);
  };

  if (isFile) {
    const key = normalizePath(current);
    if (await uploader.isExist(key, fileStats.size)) {
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
      await uploadFile(uploader, logger, path.join(current, next), root);
    }
  }
};
