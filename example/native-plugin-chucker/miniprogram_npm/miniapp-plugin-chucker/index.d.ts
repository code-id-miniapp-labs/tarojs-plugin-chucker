import { chuckerStore } from "./store";
export { generateCurl, formatJson } from "./utils";
export { chuckerStore };
export type { ChuckerLog, CustomLogInput, TrackingCompleteInput, Listener } from "./store";
export interface ChuckerOptions {
    enabled?: boolean;
    maxLogs?: number;
    navigatePath?: string;
}
export declare function initChucker(options?: ChuckerOptions): void;
