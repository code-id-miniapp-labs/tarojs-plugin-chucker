import * as path from "path";

function chuckerAppLoader(this: any, source: string): string {
  // Only inject if in dev/build or check for custom environment variables if needed
  const injection = `
import { initChucker } from 'tarojs-plugin-chucker/runtime';
try {
  initChucker();
} catch (e) {
  console.error('Chucker auto-initialization error:', e);
}
`;
  return injection + source;
}

export = chuckerAppLoader;
