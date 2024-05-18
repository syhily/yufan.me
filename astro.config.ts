import { defineConfig } from 'astro/config';

const site = process.env.NODE_ENV === 'production' ? 'https://yufan.me' : 'http://localhost:4321';

// https://astro.build/config
export default defineConfig({
  site: site,
});
