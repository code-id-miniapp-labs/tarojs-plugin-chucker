# tarojs-plugin-chucker

A Chucker-like debugger plugin for Taro JS miniapps. It intercepts, logs, and displays network requests and native plugin calls (`wx.invokeNativePlugin`) directly in your miniapp during Runtime.

It automatically injects a floating trigger button into every page at build-time, which opens a dedicated full-screen debugger console.

---

## Features

- 🛰️ **API Request Interception**: Automatically hooks into `Taro.request`, `Taro.uploadFile`, and `Taro.downloadFile`.
- 🔌 **WeChat Native Plugins Tracker**: Intercepts `wx.invokeNativePlugin` parameters, callbacks, and Promise resolutions.
- 🛠️ **Build-time Injection**: Automatically injects the WXML floating debugger button and layout styling onto every compiled page, and registers `/pages/chucker/index` in-memory.
- 📋 **Copy to cURL**: Formats network calls into standard shell cURL commands and copies them to the clipboard with one tap.
- 🔍 **Interactive Console**: Beautiful dark-mode UI overlay with tabs (Overview, Request, Response), search, filters (All, Network, Native), and JSON pretty-printing.

---

## Installation

Install the package via `pnpm`, `yarn`, or `npm`:

```bash
pnpm add tarojs-plugin-chucker --save-dev
# or
yarn add tarojs-plugin-chucker --dev
# or
npm install tarojs-plugin-chucker --save-dev
```

---

## Configuration

### 1. Register Compile-Time Plugin

Add `tarojs-plugin-chucker` to the `plugins` array in your Taro project configuration:

```javascript
// config/index.js
const config = {
  // ...
  plugins: [
    [
      "tarojs-plugin-chucker",
      {
        // By default, only enabled in development. Set true to force enable.
        enabled: process.env.NODE_ENV === "development",
      },
    ],
  ],
};
```

## Dedicated Debugger Page

To navigate to the debugger manually (e.g., from custom menus or gestures):

```typescript
import Taro from "@tarojs/taro";

Taro.navigateTo({ url: "/pages/chucker/index" });
```

---

## Custom Logging

Beyond the automatic network interception, you can log **any custom event** into the Chucker console using the `chuckerStore` API. All custom entries appear alongside network logs in the same debugger UI.

### Import

```typescript
import { chuckerStore } from "tarojs-plugin-chucker/runtime";
```

### One-shot logging — `chuckerStore.log()`

Use `log()` to record a complete event in a single call. An `id` and `startTime` are auto-generated if omitted.

```typescript
// Log a WebSocket message
chuckerStore.log({
  type: "websocket",
  method: "MESSAGE",
  url: "wss://example.com/ws",
  requestData: { event: "ping" },
  status: "success",
  responseData: { event: "pong" },
});

// Log a custom analytics event
chuckerStore.log({
  type: "analytics",
  method: "TRACK",
  url: "page_view",
  requestData: { page: "/home", userId: "abc123" },
  status: "sent",
});
```

### Async tracking — `startTracking()` / `completeTracking()`

For operations that have a measurable duration (e.g., GraphQL queries, RPC calls), use the tracking pair. Duration is calculated automatically.

```typescript
// Start tracking a GraphQL mutation
const id = chuckerStore.startTracking({
  type: "graphql",
  method: "MUTATION",
  url: "https://api.example.com/graphql",
  requestData: { query: "mutation { createUser(name: \"Alice\") { id } }" },
});

// ... later when the response arrives
chuckerStore.completeTracking(id, {
  status: 200,
  responseData: { data: { createUser: { id: 1 } } },
});

// You can also provide an explicit duration (in ms)
chuckerStore.completeTracking(id, {
  status: 200,
  responseData: result,
  duration: 350,
});
```

### API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `chuckerStore.log(input)` | `string` (id) | Add a complete log entry in one call |
| `chuckerStore.startTracking(input)` | `string` (id) | Begin tracking an async operation |
| `chuckerStore.completeTracking(id, result?)` | `void` | Finalize a tracked operation |
| `chuckerStore.getLogs()` | `ChuckerLog[]` | Get all current log entries |
| `chuckerStore.clear()` | `void` | Clear all log entries |
| `chuckerStore.subscribe(listener)` | `() => void` | Subscribe to log changes, returns unsubscribe function |

### `CustomLogInput` fields

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `type` | `"network" \| "native" \| string` | ✅ | — |
| `method` | `string` | ✅ | — |
| `url` | `string` | ✅ | — |
| `id` | `string` | ❌ | Auto-generated (`usr_xxxxx`) |
| `startTime` | `number` | ❌ | `Date.now()` |
| `requestHeaders` | `Record<string, string>` | ❌ | — |
| `requestData` | `any` | ❌ | — |
| `status` | `string \| number` | ❌ | — |
| `responseHeaders` | `Record<string, string>` | ❌ | — |
| `responseData` | `any` | ❌ | — |
| `error` | `string` | ❌ | — |
| `duration` | `number` | ❌ | — |
