import { chuckerStore } from "./store";
import { initInterceptors, patchPageAndComponent } from "./interceptor";
export { generateCurl, formatJson } from "./utils";

export interface ChuckerOptions {
  /**
   * Whether Chucker should be active.
   * Defaults to `process.env.NODE_ENV === "development"` when not specified.
   * Pass `true` to force-enable in production, `false` to fully disable.
   */
  enabled?: boolean;
  /**
   * Maximum number of log entries to keep in memory.
   * Oldest entries are evicted when the limit is reached.
   * @default 100
   */
  maxLogs?: number;
  /**
   * Override the URL path for the Chucker inspector page.
   * Useful if you placed the page at a non-standard path.
   * @default "/pages/chucker/index"
   */
  navigatePath?: string;
}

/**
 * Initialise miniapp-chucker.
 *
 * Call this once at the top of your `app.js` / `app.ts` before any pages load.
 *
 * @example
 * // Native WeApp / TCMPP
 * import { initChucker } from 'miniapp-chucker';
 * initChucker({ enabled: true });
 *
 * @example
 * // TaroJS — called automatically by tarojs-plugin-chucker loader
 * import { initChucker } from 'miniapp-chucker';
 * initChucker();
 */
export function initChucker(options?: ChuckerOptions) {
  // Enabled by default unless explicitly passed as false
  const enabled = options?.enabled !== undefined ? options.enabled : true;

  if (!enabled) {
    console.log("[miniapp-chucker] Disabled.");
    return;
  }

  chuckerStore.init(options?.maxLogs ?? 100);
  initInterceptors();
  patchPageAndComponent(options?.navigatePath ?? "/pages/chucker/index");

  console.log("[miniapp-chucker] Initialized.");
}

export { chuckerStore };
export type { ChuckerLog, CustomLogInput, TrackingCompleteInput, Listener } from "./store";
