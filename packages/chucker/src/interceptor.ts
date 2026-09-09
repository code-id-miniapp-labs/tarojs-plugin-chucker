import { chuckerStore } from "./store";

declare const wx: any;
declare const my: any;
declare const tt: any;
declare const Page: any;

function getGlobalApi(): any {
  if (typeof wx !== "undefined") return wx;
  if (typeof my !== "undefined") return my;
  if (typeof tt !== "undefined") return tt;
  try {
    if (typeof (globalThis as any).tx !== "undefined") return (globalThis as any).tx;
  } catch (e) {}
  return null;
}

const completedIds = new Set<string>();
function markCompleted(id: string): boolean {
  if (completedIds.has(id)) return false;
  completedIds.add(id);
  setTimeout(() => completedIds.delete(id), 30000);
  return true;
}

function safePatchMethod(
  api: any,
  methodName: string,
  createWrapper: (original: Function) => Function,
) {
  if (!api) return;
  const original = api[methodName];
  if (typeof original !== "function" || (original as any).__chuckerPatched) return;

  const wrapped = createWrapper(original);
  (wrapped as any).__chuckerPatched = true;

  try {
    Object.defineProperty(api, methodName, {
      value: wrapped,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    return;
  } catch (_e) {}

  try {
    Object.defineProperty(api, methodName, {
      get() {
        return wrapped;
      },
      set() {},
      configurable: true,
      enumerable: true,
    });
    return;
  } catch (_e) {}

  try {
    let proto = Object.getPrototypeOf(api);
    while (proto && proto !== Object.prototype) {
      const desc = Object.getOwnPropertyDescriptor(proto, methodName);
      if (desc) {
        if (desc.get || !desc.writable) {
          Object.defineProperty(proto, methodName, {
            get() {
              return wrapped;
            },
            set() {},
            configurable: true,
            enumerable: true,
          });
          return;
        } else {
          Object.defineProperty(proto, methodName, {
            value: wrapped,
            writable: true,
            configurable: true,
            enumerable: true,
          });
          return;
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
  } catch (_e) {}

  try {
    api[methodName] = wrapped;
  } catch (_e) {}
}

function patchNetworkMethod(
  api: any,
  methodName: "request" | "uploadFile" | "downloadFile",
  type: "http" | "upload" | "download",
) {
  safePatchMethod(api, methodName, (original) => {
    return function (this: any, options: any) {
      if (!options || !options.url) {
        return original.call(this, options);
      }

      const url = options.url;
      const method = (options.method || (type === "upload" ? "POST" : "GET")).toUpperCase();
      const requestHeaders = options.header || {};
      const requestData =
        type === "upload"
          ? { filePath: options.filePath, name: options.name, formData: options.formData }
          : options.data;

      const logId = chuckerStore.startTracking({
        type: "network",
        method,
        url,
        requestHeaders,
        requestData,
      });

      let responseHeaders: any = null;
      let responseStatusCode: number | undefined;

      const origSuccess = options.success;
      const origFail = options.fail;
      const origComplete = options.complete;

      options.success = function (this: any, res: any) {
        if (markCompleted(logId)) {
          const status = res && res.statusCode ? res.statusCode : 200;
          chuckerStore.completeTracking(logId, {
            status,
            responseHeaders: responseHeaders || (res ? res.header || res.headers : {}),
            responseData:
              type === "download"
                ? { tempFilePath: res && res.tempFilePath }
                : res
                  ? res.data
                  : undefined,
          });
        }
        if (typeof origSuccess === "function") {
          origSuccess.call(this, res);
        }
      };

      options.fail = function (this: any, err: any) {
        if (markCompleted(logId)) {
          chuckerStore.completeTracking(logId, {
            status: responseStatusCode || "error",
            responseHeaders: responseHeaders || {},
            error: (err && (err.errMsg || err.message)) || "Network request failed",
          });
        }
        if (typeof origFail === "function") {
          origFail.call(this, err);
        }
      };

      options.complete = function (this: any, res: any) {
        if (markCompleted(logId)) {
          const isErr =
            !res ||
            (res.statusCode && res.statusCode >= 400) ||
            (res.errMsg && res.errMsg.includes("fail"));
          chuckerStore.completeTracking(logId, {
            status: res && res.statusCode ? res.statusCode : isErr ? "error" : "success",
            responseHeaders: responseHeaders || (res ? res.header || res.headers : {}),
            responseData: res ? res.data : undefined,
            error: isErr ? res && (res.errMsg || res.message) : undefined,
          });
        }
        if (typeof origComplete === "function") {
          origComplete.call(this, res);
        }
      };

      try {
        const task = original.call(this, options);
        if (task && typeof task === "object") {
          if (typeof task.onHeadersReceived === "function") {
            const origOnHeaders = task.onHeadersReceived;
            task.onHeadersReceived = function (this: any, cb: any) {
              return origOnHeaders.call(this, (headerRes: any) => {
                if (headerRes && headerRes.header) {
                  responseHeaders = headerRes.header;
                  responseStatusCode = headerRes.statusCode;
                }
                if (typeof cb === "function") cb(headerRes);
              });
            };
          }
        }
        return task;
      } catch (err: any) {
        if (markCompleted(logId)) {
          chuckerStore.completeTracking(logId, {
            status: "error",
            error: err && err.message ? err.message : String(err),
          });
        }
        throw err;
      }
    };
  });
}

function patchInvokeNativePlugin(api: any) {
  if (!api || typeof api.invokeNativePlugin !== "function") return;

  safePatchMethod(api, "invokeNativePlugin", (original) => {
    return function (this: any, name: string, params: any, callback?: Function) {
      const logId = chuckerStore.startTracking({
        type: "native",
        method: "NATIVE",
        url: name,
        requestData: params,
      });

      const wrappedCb = (res: any) => {
        if (markCompleted(logId)) {
          const status = res && res.code !== undefined ? res.code : 0;
          chuckerStore.completeTracking(logId, {
            status,
            responseData: res,
            error: status !== 0 ? (res && res.message) || "Native plugin call error" : undefined,
          });
        }
        if (typeof callback === "function") callback(res);
      };

      try {
        return original.call(this, name, params, wrappedCb);
      } catch (err: any) {
        if (markCompleted(logId)) {
          chuckerStore.completeTracking(logId, {
            status: "error",
            error: err && err.message ? err.message : String(err),
          });
        }
        throw err;
      }
    };
  });
}

export function patchPageAndComponent(navigateUrl = "/pages/chucker/index") {
  if (typeof Page !== "undefined") {
    const origPage = Page;
    // @ts-ignore
    Page = function (config: any) {
      if (!config) return origPage(config);
      const origOnShow = config.onShow;
      const origOnUnload = config.onUnload;

      config.chuckerTap = function () {
        const api = getGlobalApi();
        if (api && typeof api.navigateTo === "function") {
          api.navigateTo({
            url: navigateUrl,
            fail: () => api.navigateTo({ url: "/pages/chucker/index" }),
          });
        }
      };

      config.onShow = function (this: any, ...args: any[]) {
        if (this && typeof this.setData === "function") {
          this.__chuckerUnsub = chuckerStore.subscribe(() => {
            try {
              this.setData({
                "__chucker.count": chuckerStore.getLogs().length,
                "__chucker.hasError": chuckerStore
                  .getLogs()
                  .some(
                    (l) =>
                      l.status === "error" || (typeof l.status === "number" && l.status >= 400),
                  ),
              });
            } catch (e) {}
          });
        }
        if (typeof origOnShow === "function") return origOnShow.apply(this, args);
      };

      config.onUnload = function (this: any, ...args: any[]) {
        if (typeof this.__chuckerUnsub === "function") {
          this.__chuckerUnsub();
          this.__chuckerUnsub = null;
        }
        if (typeof origOnUnload === "function") return origOnUnload.apply(this, args);
      };

      return origPage(config);
    };
  }
}

export function initInterceptors() {
  const api = getGlobalApi();
  if (!api) return;

  patchNetworkMethod(api, "request", "http");
  patchNetworkMethod(api, "uploadFile", "upload");
  patchNetworkMethod(api, "downloadFile", "download");
  patchInvokeNativePlugin(api);
}
