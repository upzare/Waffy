/// <reference types="chrome" />

declare module "*.css";

declare global {
  const chrome: typeof chrome;

  interface Window {
    ai: {
      [key: string]: {
        new (...args: any[]): any;
        (...args: any[]): any;
        [subKey: string]: any;
      };
    };
  }
  declare const self: Window & typeof globalThis;
}
