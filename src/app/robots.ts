import { options } from '#site/content';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
      },
    ],
    sitemap: options.website + '/sitemap.xml',
    host: options.website,
  };
}
