/// <reference types="chrome" />

declare module "*.css";

declare module "*.css?raw" {
  const css: string;
  export default css;
}

declare module "*.woff2?bytes" {
  const bytes: Uint8Array<ArrayBuffer>;
  export default bytes;
}

interface ImportMetaEnv {
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
