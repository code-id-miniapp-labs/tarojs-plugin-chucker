import { chuckerStore } from "./store";
import { initInterceptors, patchPageAndComponent } from "./interceptor";
export { generateCurl, formatJson } from "./utils";
export { buildExportText } from "./export";
export type { ExportOptions } from "./export";
export { chuckerStore };
export type { ChuckerLog, CustomLogInput, TrackingCompleteInput, Listener } from "./store";

export interface ChuckerOptions {
  enabled?: boolean;
  maxLogs?: number;
  navigatePath?: string;
  /**
   * Patch `console.log`, `console.warn`, `console.error`, and `console.info`
   * to capture logs in the Chucker inspector.
   * @default false
   */
  console?: boolean;
}

export function initChucker(options?: ChuckerOptions) {
  const enabled = options?.enabled !== undefined ? options.enabled : true;

  if (!enabled) {
    console.log("[miniapp-chucker] Disabled.");
    return;
  }

  chuckerStore.init(options?.maxLogs ?? 100);
  initInterceptors({ console: options?.console });
  // Default: inspector lives in the "chucker" sub-package created by the CLI.
  patchPageAndComponent(options?.navigatePath ?? "/chucker/index");

  console.log("[miniapp-chucker] Initialized.");
}
