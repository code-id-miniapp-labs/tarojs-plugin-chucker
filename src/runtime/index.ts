import Taro from "@tarojs/taro";
import { initInterceptors } from "./interceptor";
import { chuckerStore } from "./store";
import { Chucker } from "./components/Chucker";

export interface ChuckerInitOptions {
  maxLogs?: number;
}

export function initChucker(options?: ChuckerInitOptions) {
  const maxLogs = options?.maxLogs ?? 100;
  // Initialize state store
  chuckerStore.init(maxLogs);
  // Initialize API interceptors
  initInterceptors();

  // Monkey-patch native Page and Component constructors if they exist (for injected WXML floating button triggers)
  const globalObj =
    typeof globalThis !== "undefined"
      ? globalThis
      : typeof global !== "undefined"
        ? global
        : typeof window !== "undefined"
          ? window
          : {};
  // @ts-ignore
  if (typeof Page === "function") {
    // @ts-ignore
    const originalPage = Page;
    // @ts-ignore
    globalObj.Page = function (pageOpts: any) {
      if (pageOpts) {
        pageOpts.chuckerTap = function () {
          Taro.navigateTo({ url: "/pages/chucker/index" });
        };
      }
      return originalPage(pageOpts);
    };
  }
  // @ts-ignore
  if (typeof Component === "function") {
    // @ts-ignore
    const originalComponent = Component;
    // @ts-ignore
    globalObj.Component = function (compOpts: any) {
      if (compOpts) {
        if (!compOpts.methods) {
          compOpts.methods = {};
        }
        compOpts.methods.chuckerTap = function () {
          Taro.navigateTo({ url: "/pages/chucker/index" });
        };
        compOpts.chuckerTap = function () {
          Taro.navigateTo({ url: "/pages/chucker/index" });
        };
      }
      return originalComponent(compOpts);
    };
  }

  console.log("Taro Chucker Interceptors initialized");
}

export { Chucker, chuckerStore };
export type { ChuckerLog } from "./interceptor";
export type { CustomLogInput, TrackingCompleteInput } from "./store";
