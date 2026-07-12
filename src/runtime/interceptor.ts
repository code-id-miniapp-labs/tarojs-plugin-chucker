import Taro from "@tarojs/taro";
import { chuckerStore } from "./store";

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

const completedIds = new Set<string>();

function markCompleted(id: string): boolean {
  if (completedIds.has(id)) {
    return false;
  }
  completedIds.add(id);
  // Clean up completed IDs list after 30 seconds to prevent leaks
  setTimeout(() => completedIds.delete(id), 30000);
  return true;
}

/**
 * Chucker interceptor for Taro.addInterceptor.
 * Uses the official onion-model chain to intercept Taro.request calls.
 */
const chuckerRequestInterceptor: Taro.interceptor = (chain: Taro.Chain) => {
  const requestParams = chain.requestParams as Taro.request.Option;
  const { method = "GET", url, header, data } = requestParams;

  const id = "req_" + Math.random().toString(36).substring(2, 9);
  const startTime = Date.now();

  chuckerStore.handleRequestStart({
    id,
    type: "network",
    method: method.toUpperCase(),
    url,
    requestHeaders: header || {},
    requestData: data,
    startTime,
  });

  return chain.proceed(requestParams).then(
    (res: Taro.request.SuccessCallbackResult) => {
      if (markCompleted(id)) {
        const duration = Date.now() - startTime;
        chuckerStore.handleRequestComplete({
          id,
          status: res.statusCode || 200,
          responseHeaders: res.header || {},
          responseData: res.data,
          duration,
        });
      }
      return res;
    },
    (err: TaroGeneral.CallbackResult) => {
      if (markCompleted(id)) {
        const duration = Date.now() - startTime;
        chuckerStore.handleRequestComplete({
          id,
          status: "fail",
          error: err ? err.errMsg || JSON.stringify(err) : "Request failed",
          duration,
        });
      }
      throw err;
    },
  );
};

// Helper to proxy custom methods/properties (like abort, progress callbacks)
// from the original request/upload/download task to the hijacked Promise
function proxyTask(target: any, source: any) {
  if (!source) return target;

  const keys = [
    ...Object.keys(source),
    ...Object.getOwnPropertyNames(Object.getPrototypeOf(source) || {}),
  ];
  keys.forEach((key) => {
    if (key === "constructor" || key === "then" || key === "catch" || key === "finally") return;
    try {
      if (typeof source[key] === "function") {
        target[key] = source[key].bind(source);
      } else {
        Object.defineProperty(target, key, {
          get: () => source[key],
          set: (val) => {
            source[key] = val;
          },
          configurable: true,
        });
      }
    } catch (e) {}
  });
  return target;
}

export function initInterceptors() {
  // 1. Intercept Taro.request via Taro.addInterceptor (official API)
  Taro.addInterceptor(chuckerRequestInterceptor);

  // 2. Intercept Taro.uploadFile (addInterceptor doesn't cover uploadFile)
  const originalUploadFile = Taro.uploadFile;
  if (typeof originalUploadFile === "function") {
    (Taro as any).uploadFile = function (options: any): any {
      if (!options) return (originalUploadFile as any).apply(this, arguments as any);

      const id = "upl_" + Math.random().toString(36).substring(2, 9);
      const startTime = Date.now();
      const { url, filePath, name, header, formData } = options;

      chuckerStore.handleRequestStart({
        id,
        type: "network",
        method: "UPLOAD",
        url,
        requestHeaders: header || {},
        requestData: { filePath, name, formData },
        startTime,
      });

      const clonedOptions = { ...options };
      const originalSuccess = options.success;
      const originalFail = options.fail;

      clonedOptions.success = function (res: any) {
        if (markCompleted(id)) {
          const duration = Date.now() - startTime;
          let responseData = res.data;
          try {
            if (typeof responseData === "string" && responseData.trim().startsWith("{")) {
              responseData = JSON.parse(responseData);
            }
          } catch (e) {}

          chuckerStore.handleRequestComplete({
            id,
            status: res.statusCode || 200,
            responseHeaders: res.header || res.headers || {},
            responseData,
            duration,
          });
        }
        if (originalSuccess) return originalSuccess.apply(this, arguments as any);
      };

      clonedOptions.fail = function (err: any) {
        if (markCompleted(id)) {
          const duration = Date.now() - startTime;
          chuckerStore.handleRequestComplete({
            id,
            status: "fail",
            error: err ? err.errMsg || JSON.stringify(err) : "Upload failed",
            duration,
          });
        }
        if (originalFail) return originalFail.apply(this, arguments as any);
      };

      try {
        const args = [clonedOptions, ...Array.prototype.slice.call(arguments, 1)];
        const promise = (originalUploadFile as any).apply(this, args);
        if (promise && typeof promise.then === "function") {
          const hijackedPromise = promise.then(
            (res: any) => {
              if (markCompleted(id)) {
                const duration = Date.now() - startTime;
                let responseData = res.data;
                try {
                  if (typeof responseData === "string" && responseData.trim().startsWith("{")) {
                    responseData = JSON.parse(responseData);
                  }
                } catch (e) {}

                chuckerStore.handleRequestComplete({
                  id,
                  status: res.statusCode || 200,
                  responseHeaders: res.header || res.headers || {},
                  responseData,
                  duration,
                });
              }
              return res;
            },
            (err: any) => {
              if (markCompleted(id)) {
                const duration = Date.now() - startTime;
                chuckerStore.handleRequestComplete({
                  id,
                  status: "fail",
                  error: err ? err.errMsg || JSON.stringify(err) : "Upload failed",
                  duration,
                });
              }
              throw err;
            },
          );
          return proxyTask(hijackedPromise, promise);
        }
        return promise;
      } catch (e: any) {
        if (markCompleted(id)) {
          const duration = Date.now() - startTime;
          chuckerStore.handleRequestComplete({
            id,
            status: "fail",
            error: e ? e.message || String(e) : "Upload error",
            duration,
          });
        }
        throw e;
      }
    };
  }

  // 3. Intercept Taro.downloadFile (addInterceptor doesn't cover downloadFile)
  const originalDownloadFile = Taro.downloadFile;
  if (typeof originalDownloadFile === "function") {
    (Taro as any).downloadFile = function (options: any): any {
      if (!options) return (originalDownloadFile as any).apply(this, arguments as any);

      const id = "dwl_" + Math.random().toString(36).substring(2, 9);
      const startTime = Date.now();
      const { url, header } = options;

      chuckerStore.handleRequestStart({
        id,
        type: "network",
        method: "DOWNLOAD",
        url,
        requestHeaders: header || {},
        startTime,
      });

      const clonedOptions = { ...options };
      const originalSuccess = options.success;
      const originalFail = options.fail;

      clonedOptions.success = function (res: any) {
        if (markCompleted(id)) {
          const duration = Date.now() - startTime;
          chuckerStore.handleRequestComplete({
            id,
            status: res.statusCode || 200,
            responseHeaders: res.header || res.headers || {},
            responseData: { tempFilePath: res.tempFilePath, apFilePath: res.apFilePath },
            duration,
          });
        }
        if (originalSuccess) return originalSuccess.apply(this, arguments as any);
      };

      clonedOptions.fail = function (err: any) {
        if (markCompleted(id)) {
          const duration = Date.now() - startTime;
          chuckerStore.handleRequestComplete({
            id,
            status: "fail",
            error: err ? err.errMsg || JSON.stringify(err) : "Download failed",
            duration,
          });
        }
        if (originalFail) return originalFail.apply(this, arguments as any);
      };

      try {
        const args = [clonedOptions, ...Array.prototype.slice.call(arguments, 1)];
        const promise = (originalDownloadFile as any).apply(this, args);
        if (promise && typeof promise.then === "function") {
          const hijackedPromise = promise.then(
            (res: any) => {
              if (markCompleted(id)) {
                const duration = Date.now() - startTime;
                chuckerStore.handleRequestComplete({
                  id,
                  status: res.statusCode || 200,
                  responseHeaders: res.header || res.headers || {},
                  responseData: { tempFilePath: res.tempFilePath, apFilePath: res.apFilePath },
                  duration,
                });
              }
              return res;
            },
            (err: any) => {
              if (markCompleted(id)) {
                const duration = Date.now() - startTime;
                chuckerStore.handleRequestComplete({
                  id,
                  status: "fail",
                  error: err ? err.errMsg || JSON.stringify(err) : "Download failed",
                  duration,
                });
              }
              throw err;
            },
          );
          return proxyTask(hijackedPromise, promise);
        }
        return promise;
      } catch (e: any) {
        if (markCompleted(id)) {
          const duration = Date.now() - startTime;
          chuckerStore.handleRequestComplete({
            id,
            status: "fail",
            error: e ? e.message || String(e) : "Download error",
            duration,
          });
        }
        throw e;
      }
    };
  }

  // 4. Intercept wx.invokeNativePlugin (not part of Taro's interceptor chain)
  // @ts-ignore
  const globalObj = typeof wx !== "undefined" ? wx : typeof my !== "undefined" ? my : null;
  if (globalObj) {
    const setupNativeInterceptor = (original: any) => {
      if (typeof original !== "function" || original.isChuckerOverridden) return original;

      const fn = function (this: any, name: any, args: any, ...rest: any[]) {
        const id = "nat_" + Math.random().toString(36).substring(2, 9);
        const startTime = Date.now();

        let actualName = "NATIVE_CALL";
        let actualArgs = args;
        let finalArgs = args;

        if (typeof name === "string") {
          actualName = name;
          if (args && typeof args === "object") {
            finalArgs = { ...args };
            const originalSuccess = args.success;
            const originalFail = args.fail;

            finalArgs.success = function (res: any) {
              if (markCompleted(id)) {
                const duration = Date.now() - startTime;
                chuckerStore.handleRequestComplete({
                  id,
                  status: "success",
                  responseData: res,
                  duration,
                });
              }
              if (originalSuccess) return originalSuccess.apply(this, arguments as any);
            };

            finalArgs.fail = function (err: any) {
              if (markCompleted(id)) {
                const duration = Date.now() - startTime;
                chuckerStore.handleRequestComplete({
                  id,
                  status: "fail",
                  error: err
                    ? typeof err === "object"
                      ? JSON.stringify(err)
                      : String(err)
                    : "Native call failed",
                  duration,
                });
              }
              if (originalFail) return originalFail.apply(this, arguments as any);
            };
          }
        } else if (name && typeof name === "object") {
          actualName = name.api_name || "NATIVE_CALL";
          actualArgs = name.data || name;

          const clonedObj = { ...name };
          const originalSuccess = name.success;
          const originalFail = name.fail;

          clonedObj.success = function (res: any) {
            if (markCompleted(id)) {
              const duration = Date.now() - startTime;
              chuckerStore.handleRequestComplete({
                id,
                status: "success",
                responseData: res,
                duration,
              });
            }
            if (originalSuccess) return originalSuccess.apply(this, arguments as any);
          };

          clonedObj.fail = function (err: any) {
            if (markCompleted(id)) {
              const duration = Date.now() - startTime;
              chuckerStore.handleRequestComplete({
                id,
                status: "fail",
                error: err
                  ? typeof err === "object"
                    ? JSON.stringify(err)
                    : String(err)
                  : "Native call failed",
                duration,
              });
            }
            if (originalFail) return originalFail.apply(this, arguments as any);
          };

          name = clonedObj;
        }

        chuckerStore.handleRequestStart({
          id,
          type: "native",
          method: "NATIVE",
          url: actualName,
          requestData: actualArgs,
          startTime,
        });

        // Hook callback function if passed directly as argument
        const lastArg = rest[rest.length - 1];
        if (typeof lastArg === "function") {
          rest[rest.length - 1] = function (res: any) {
            if (markCompleted(id)) {
              const duration = Date.now() - startTime;
              chuckerStore.handleRequestComplete({
                id,
                status:
                  res && (res.errCode === 0 || res.errorCode === 0 || !res.errCode)
                    ? "success"
                    : "fail",
                responseData: res,
                duration,
              });
            }
            return lastArg.apply(this, arguments as any);
          };
        }

        try {
          const result = original.apply(this, [name, finalArgs, ...rest]);
          if (result && typeof result.then === "function") {
            return result.then(
              (res: any) => {
                if (markCompleted(id)) {
                  const duration = Date.now() - startTime;
                  chuckerStore.handleRequestComplete({
                    id,
                    status: "success",
                    responseData: res,
                    duration,
                  });
                }
                return res;
              },
              (err: any) => {
                if (markCompleted(id)) {
                  const duration = Date.now() - startTime;
                  chuckerStore.handleRequestComplete({
                    id,
                    status: "fail",
                    error: err
                      ? typeof err === "object"
                        ? JSON.stringify(err)
                        : String(err)
                      : "Native call failed",
                    duration,
                  });
                }
                throw err;
              },
            );
          }
          return result;
        } catch (error: any) {
          if (markCompleted(id)) {
            const duration = Date.now() - startTime;
            chuckerStore.handleRequestComplete({
              id,
              status: "fail",
              error: error ? error.message || String(error) : "Synchronous native error",
              duration,
            });
          }
          throw error;
        }
      };

      (fn as any).isChuckerOverridden = true;
      return fn;
    };

    let currentVal = globalObj.invokeNativePlugin;
    let interceptedVal = setupNativeInterceptor(currentVal);

    if (currentVal) {
      try {
        Object.defineProperty(globalObj, "invokeNativePlugin", {
          value: interceptedVal,
          writable: true,
          configurable: true,
        });
      } catch (e) {
        try {
          globalObj.invokeNativePlugin = interceptedVal;
        } catch (err) {}
      }
    }

    try {
      Object.defineProperty(globalObj, "invokeNativePlugin", {
        get() {
          return interceptedVal;
        },
        set(newVal) {
          currentVal = newVal;
          interceptedVal = setupNativeInterceptor(newVal);
        },
        configurable: true,
      });
    } catch (e) {}
  }
}
