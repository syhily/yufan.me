import type { AstroIntegration } from 'astro';

const lazyload: AstroIntegration = {
  name: 'image-lazyload',
  hooks: {
    'astro:config:setup': ({ addMiddleware }) => {},
  },
};

export default () => lazyload;
