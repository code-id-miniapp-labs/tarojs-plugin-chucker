import Taro from "@tarojs/taro";
import { ChuckerLog } from "./interceptor";

export type Listener = (logs: ChuckerLog[]) => void;

class ChuckerStore {
  private logs: ChuckerLog[] = [];
  private listeners: Set<Listener> = new Set();
  private maxLogs: number = 100;
  private isInitialized: boolean = false;
  private lastNotifyTime: number = 0;
  private notifyTimeout: any = null;

  public init(maxLogs = 100) {
    this.maxLogs = maxLogs;
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

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
    this.lastNotifyTime = Date.now();
    if (this.notifyTimeout) {
      clearTimeout(this.notifyTimeout);
      this.notifyTimeout = null;
    }
    this.listeners.forEach((listener) => {
      try {
        listener(this.logs);
      } catch (e) {
        console.error("Chucker store notify error:", e);
      }
    });
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

const globalObj =
  typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : {};
// @ts-ignore
if (!globalObj.__CHUCKER_STORE__) {
  // @ts-ignore
  globalObj.__CHUCKER_STORE__ = new ChuckerStore();
}
// @ts-ignore
export const chuckerStore: ChuckerStore = globalObj.__CHUCKER_STORE__;
