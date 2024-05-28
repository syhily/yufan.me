/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="vite-plugin-arraybuffer/types" />

interface ImportMetaEnv {
  readonly POSTGRES_HOST: string;
  readonly POSTGRES_PORT: string;
  readonly POSTGRES_USERNAME: string;
  readonly POSTGRES_PASSWORD: string;
  readonly POSTGRES_DATABASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
