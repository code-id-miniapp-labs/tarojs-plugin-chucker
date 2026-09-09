/**
 * Webpack loader that prepends initChucker() to the host app entry file.
 * This runs at build time and ensures Chucker is initialised before any pages load.
 */
function chuckerAppLoader(this: any, source: string): string {
  const injection = `
import { initChucker } from 'miniapp-chucker';
try {
  initChucker();
} catch (e) {
  console.error('[miniapp-chucker] Auto-initialization error:', e);
}
`;
  return injection + source;
}

export = chuckerAppLoader;
