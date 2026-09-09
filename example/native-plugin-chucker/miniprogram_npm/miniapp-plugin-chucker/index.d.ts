import { chuckerStore } from "./store";
export { generateCurl, formatJson } from "./utils";
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
export declare function initChucker(options?: ChuckerOptions): void;
