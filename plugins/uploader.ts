import type { AstroIntegration, AstroIntegrationLogger } from 'astro';
import { z } from 'astro/zod';
import fs from 'node:fs';
import path from 'node:path';
import { Operator } from 'opendal';
import { rimrafSync } from 'rimraf';

const S3Options = z
  .object({
    // The directories that you want to upload to S3.
    paths: z.array(z.string()).min(1),
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
    // The extra options provided by opendal.
    // All the methods in https://docs.rs/opendal/latest/opendal/services/struct.S3.html#implementations can be treated as an option.
    extraOptions: z.record(z.string(), z.string()).default({}),
  })
  .strict()
  .refine((opts) => (opts.region === 'auto' ? opts.endpoint !== undefined : true));

const parseOptions = (
  opts: z.input<typeof S3Options>,
  logger: AstroIntegrationLogger,
): { options: Record<string, string>; paths: string[] } => {
  try {
    const { paths, bucket, root, accessKey, secretAccessKey, region, endpoint, extraOptions } = S3Options.parse(opts);

    // Create opendal operator.
    // The common configurations are listed here https://docs.rs/opendal/latest/opendal/services/struct.S3.html#configuration
    const options: Record<string, string> = {
      ...extraOptions,
      root: root,
      bucket: bucket,
      region: region,
      access_key_id: accessKey,
      secret_access_key: secretAccessKey,
    };
    if (endpoint !== undefined) {
      options.endpoint = endpoint;
    }

    return { options, paths };
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

export const uploader = (opts: z.input<typeof S3Options>): AstroIntegration => ({
  name: 'S3 Uploader',
  hooks: {
    'astro:build:done': async ({ dir, logger }: { dir: URL; logger: AstroIntegrationLogger }) => {
      const { options, paths } = parseOptions(opts, logger);
      const operator = new Operator('s3', options);

      logger.info(`Start to upload static files in dir ${paths} to S3 compatible backend.`);

      for (const current of paths) {
        await uploadFile(operator, logger, current, dir.pathname);
        rimrafSync(path.join(dir.pathname, current));
      }

      logger.info('Upload all the files successfully.');
    },
  },
});

// Change the windows path into the unix path.
const normalizePath = (current: string): string => {
  return current.includes(path.win32.sep) ? current.split(path.win32.sep).join(path.posix.sep) : current;
};

const uploadFile = async (operator: Operator, logger: AstroIntegrationLogger, current: string, root: string) => {
  const filePath = path.join(root, current);
  const isFile = !fs.statSync(filePath).isDirectory();
  const uploadAction = async (key: string) => {
    logger.info(`Start to upload file: ${key}`);
    const body = fs.readFileSync(filePath);
    await operator.write(key, body);
  };

  if (isFile) {
    const key = normalizePath(current);
    try {
      const meta = await operator.stat(key);
      if (meta.isFile()) {
        logger.info(`${key} exists on backend, skip.`);
      } else {
        await uploadAction(key);
      }
    } catch (error) {
      await uploadAction(key);
    }
    return;
  }

  // Reclusive upload files.
  for (const next of fs.readdirSync(filePath)) {
    if (next.startsWith('.')) {
      continue;
    }
    await uploadFile(operator, logger, path.join(current, next), root);
  }
};
