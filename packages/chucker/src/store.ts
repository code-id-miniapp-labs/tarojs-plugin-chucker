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

class ChuckerStore {
  private logs: ChuckerLog[] = [];
  private listeners: Set<Listener> = new Set();
  private maxLogs: number = 100;
  private isInitialized: boolean = false;
  private lastNotifyTime: number = 0;
  private notifyTimeout: any = null;
  private _notifying: boolean = false;
  private _pendingNotify: boolean = false;

  public init(maxLogs = 100) {
    this.maxLogs = maxLogs;
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  // ──────────────────────────────────────────────
  // Internal API (used by interceptors)
  // ──────────────────────────────────────────────

  public handleRequestStart(log: ChuckerLog) {
    this.logs = [log, ...this.logs];
    this.trimLogs();
    this.notify();
  }

  public handleRequestComplete(payload: Partial<ChuckerLog> & { id: string }) {
    this.logs = this.logs.map((log) => {
      if (log.id === payload.id) {
        return { ...log, ...payload } as ChuckerLog;
      }
      return log;
    });
    this.notify();
  }

  // ──────────────────────────────────────────────
  // Public API (for user-created log entries)
  // ──────────────────────────────────────────────

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
  public log(input: CustomLogInput): string {
    const id = input.id || "usr_" + Math.random().toString(36).substring(2, 9);
    const log: ChuckerLog = {
      ...input,
      id,
      startTime: input.startTime || Date.now(),
    };
    this.handleRequestStart(log);
    return id;
  }

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
  public startTracking(input: CustomLogInput): string {
    const id = input.id || "usr_" + Math.random().toString(36).substring(2, 9);
    const log: ChuckerLog = {
      ...input,
      id,
      startTime: input.startTime || Date.now(),
    };
    this.handleRequestStart(log);
    return id;
  }

  /**
   * Complete a previously tracked operation.
   * Duration is calculated automatically if not provided.
   */
  public completeTracking(id: string, result: TrackingCompleteInput = {}): void {
    const existing = this.logs.find((log) => log.id === id);
    const duration = result.duration ?? (existing ? Date.now() - existing.startTime : undefined);
    this.handleRequestComplete({
      id,
      ...result,
      duration,
    });
  }

  // ──────────────────────────────────────────────
  // Core
  // ──────────────────────────────────────────────

  private trimLogs() {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
  }

  public getLogs(): ChuckerLog[] {
    return this.logs;
  }

  public clear() {
    this.logs = [];
    this.executeNotify();
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    // Provide initial state immediately
    listener(this.logs);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private executeNotify() {
    if (this._notifying) {
      this._pendingNotify = true;
      return;
    }

    this._notifying = true;
    this.lastNotifyTime = Date.now();
    if (this.notifyTimeout) {
      clearTimeout(this.notifyTimeout);
      this.notifyTimeout = null;
    }

    try {
      this.listeners.forEach((listener) => {
        try {
          listener(this.logs);
        } catch (_e) {
          // Silently swallow to avoid triggering patched console.error
        }
      });
    } finally {
      this._notifying = false;
    }

    // Flush any logs that arrived while we were notifying
    if (this._pendingNotify) {
      this._pendingNotify = false;
      this.executeNotify();
    }
  }

  private notify() {
    const now = Date.now();
    const throttleDelay = 80;

    if (this.notifyTimeout) {
      clearTimeout(this.notifyTimeout);
      this.notifyTimeout = null;
    }

    const timeSinceLastNotify = now - this.lastNotifyTime;
    if (timeSinceLastNotify >= throttleDelay) {
      this.executeNotify();
    } else {
      this.notifyTimeout = setTimeout(() => {
        this.executeNotify();
      }, throttleDelay - timeSinceLastNotify);
    }
  }
}

const globalObj: any =
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof global !== "undefined"
      ? global
      : typeof window !== "undefined"
        ? window
        : {};

if (!globalObj.__CHUCKER_STORE__) {
  globalObj.__CHUCKER_STORE__ = new ChuckerStore();
}

export const chuckerStore: ChuckerStore = globalObj.__CHUCKER_STORE__;

