import type { AstroIntegration, RouteOptions } from 'astro';

export const openGraph = (): AstroIntegration => ({
  name: 'Open Graph Generator',
  hooks: {
    'astro:route:setup': (options: { route: RouteOptions }) => {
      if (options.route.component === 'src/pages/images/og/[slug].png.ts') {
        options.route.prerender = process.env.BUILD_OPEN_GRAPH === undefined || process.env.BUILD_OPEN_GRAPH === 'true';
      }
    },
  },
});
