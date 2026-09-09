import { chuckerStore } from "./store";
import { initInterceptors, patchPageAndComponent } from "./interceptor";
export { generateCurl, formatJson } from "./utils";
export { chuckerStore };
export type { ChuckerLog, CustomLogInput, TrackingCompleteInput, Listener } from "./store";

export interface ChuckerOptions {
  enabled?: boolean;
  maxLogs?: number;
  navigatePath?: string;
}

export function initChucker(options?: ChuckerOptions) {
  const enabled = options?.enabled !== undefined ? options.enabled : true;

  if (!enabled) {
    console.log("[miniapp-chucker] Disabled.");
    return;
  }

  chuckerStore.init(options?.maxLogs ?? 100);
  initInterceptors();
  patchPageAndComponent(options?.navigatePath ?? "/miniprogram_npm/miniapp-plugin-chucker/pages/chucker/index");

  console.log("[miniapp-chucker] Initialized.");
}
