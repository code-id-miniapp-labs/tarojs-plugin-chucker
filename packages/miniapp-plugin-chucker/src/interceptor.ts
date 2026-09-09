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
    return function (this: any, name: any, args: any, ...rest: any[]) {
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

function safeSerialize(args: any[]): any {
  if (args.length === 0) return undefined;

  const serialize = (val: any, depth = 0): any => {
    if (depth > 3) return "[max depth]";
    if (val === null || val === undefined) return val;

    const t = typeof val;
    if (t === "string" || t === "number" || t === "boolean") return val;
    if (t === "function") return `[Function: ${val.name || "anonymous"}]`;
    if (t === "symbol") return val.toString();

    if (val instanceof Error) {
      return { name: val.name, message: val.message, stack: val.stack };
    }

    if (Array.isArray(val)) {
      return val.map((v) => serialize(v, depth + 1));
    }

    if (t === "object") {
      try {
        // Fast-path: if JSON.stringify works, use it
        JSON.stringify(val);
        return val;
      } catch (_e) {
        // Circular or non-serializable — walk manually
        const out: Record<string, any> = {};
        for (const key of Object.keys(val).slice(0, 50)) {
          try {
            out[key] = serialize(val[key], depth + 1);
          } catch (_e) {
            out[key] = "[unserializable]";
          }
        }
        return out;
      }
    }

    return String(val);
  };

  const serialized = args.map((a) => serialize(a));
  return serialized.length === 1 ? serialized[0] : serialized;
}

const CONSOLE_LEVELS = ["log", "warn", "error"] as const;
type ConsoleLevel = (typeof CONSOLE_LEVELS)[number];

function consoleLevelToStatus(level: ConsoleLevel): string {
  switch (level) {
    case "error":
      return "error";
    case "warn":
      return "warning";
    default:
      return "success";
  }
}

function patchConsole() {
  for (const level of CONSOLE_LEVELS) {
    safePatchMethod(console, level, (original) => {
      return function (this: any, ...args: any[]) {
        // Call original first so DevTools output is preserved
        original.apply(this, args);

        chuckerStore.log({
          type: "console",
          method: level.toUpperCase(),
          url: `console.${level}`,
          requestData: safeSerialize(args),
          status: consoleLevelToStatus(level),
        });
      };
    });
  }
}

export interface InterceptorOptions {
  /** Patch console.log / warn / error / info to capture logs. @default false */
  console?: boolean;
}

export function initInterceptors(options?: InterceptorOptions) {
  const api = getGlobalApi();
  if (!api) return;

  patchNetworkMethod(api, "request", "http");
  patchNetworkMethod(api, "uploadFile", "upload");
  patchNetworkMethod(api, "downloadFile", "download");
  patchInvokeNativePlugin(api);

  if (options?.console) {
    patchConsole();
  }
}
