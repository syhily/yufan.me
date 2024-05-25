/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Supported by vite plugin: vite-plugin-arraybuffer
declare module '*?arraybuffer' {
  const value: ArrayBuffer;

  export default value;
}

declare module '*?uint8array' {
  const value: Uint8Array;

  export default value;
}

declare module '*?arraybuffer&base64' {
  const value: ArrayBuffer;

  export default value;
}

declare module '*?uint8array&base64' {
  const value: Uint8Array;

  export default value;
}
