export interface ChuckerLog {
    id: string;
    type: "network" | "native" | (string & {});
    method: string;
    url: string;
    requestHeaders?: Record<string, string>;
    requestData?: any;
    status?: string | number;
    responseHeaders?: Record<string, string>;
    responseData?: any;
    error?: string;
    startTime: number;
    duration?: number;
}
export type Listener = (logs: ChuckerLog[]) => void;
/** Input type for user-created log entries. `id` and `startTime` are auto-generated if omitted. */
export interface CustomLogInput {
    /** Custom identifier. Auto-generated if omitted. */
    id?: string;
    /** Log category. Use built-in "network"/"native" or any custom string like "websocket", "graphql", etc. */
    type: ChuckerLog["type"];
    /** Label for the operation (e.g. "GET", "SUBSCRIBE", "QUERY"). */
    method: string;
    /** URL or identifier for the operation. */
    url: string;
    requestHeaders?: Record<string, string>;
    requestData?: any;
    status?: string | number;
    responseHeaders?: Record<string, string>;
    responseData?: any;
    error?: string;
    /** Epoch timestamp in ms. Defaults to Date.now(). */
    startTime?: number;
    duration?: number;
}
/** Payload to finalize a tracked operation started with `startTracking()`. */
export interface TrackingCompleteInput {
    status?: string | number;
    responseHeaders?: Record<string, string>;
    responseData?: any;
    error?: string;
    /** If omitted, duration is calculated from startTime automatically. */
    duration?: number;
}
declare class ChuckerStore {
    private logs;
    private listeners;
    private maxLogs;
    private isInitialized;
    private lastNotifyTime;
    private notifyTimeout;
    private _notifying;
    private _pendingNotify;
    init(maxLogs?: number): void;
    handleRequestStart(log: ChuckerLog): void;
    handleRequestComplete(payload: Partial<ChuckerLog> & {
        id: string;
    }): void;
    /**
     * Add a complete log entry in one call.
     * Useful for logging one-shot events that don't need async tracking.
     *
     * @example
     * ```ts
     * chuckerStore.log({
     *   type: "websocket",
     *   method: "MESSAGE",
     *   url: "wss://example.com/ws",
     *   requestData: { event: "ping" },
     *   status: "success",
     *   responseData: { event: "pong" },
     * });
     * ```
     */
    log(input: CustomLogInput): string;
    /**
     * Start tracking an async operation. Returns the generated log `id`.
     * Call `completeTracking(id, result)` when the operation finishes.
     *
     * @example
     * ```ts
     * const id = chuckerStore.startTracking({
     *   type: "graphql",
     *   method: "QUERY",
     *   url: "https://api.example.com/graphql",
     *   requestData: { query: "{ users { id name } }" },
     * });
     *
     * // ... later when response arrives
     * chuckerStore.completeTracking(id, {
     *   status: 200,
     *   responseData: { users: [...] },
     * });
     * ```
     */
    startTracking(input: CustomLogInput): string;
    /**
     * Complete a previously tracked operation.
     * Duration is calculated automatically if not provided.
     */
    completeTracking(id: string, result?: TrackingCompleteInput): void;
    private trimLogs;
    getLogs(): ChuckerLog[];
    clear(): void;
    subscribe(listener: Listener): () => void;
    private executeNotify;
    private notify;
}
export declare const chuckerStore: ChuckerStore;
export {};
