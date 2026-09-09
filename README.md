# miniapp-chucker

An in-app network request and native plugin call debugger for Mini Programs (WeChat, TCMPP, Alipay, ByteDance) and TaroJS applications.

Inspired by Android Chucker and Chrome DevTools, it captures network requests, uploads, downloads, and native plugin calls (`wx.invokeNativePlugin`), presenting them in a clean, dark-mode developer inspector directly inside your running Mini Program.

---

## 📦 Monorepo Packages

| Package | Version | Description |
|---|---|---|
| [`miniapp-chucker`](./packages/chucker) | [![npm](https://img.shields.io/npm/v/miniapp-chucker.svg)](https://www.npmjs.com/package/miniapp-chucker) | Core headless runtime: network interceptors & reactive state store |
| [`miniapp-plugin-chucker`](./packages/miniapp-plugin-chucker) | [![npm](https://img.shields.io/npm/v/miniapp-plugin-chucker.svg)](https://www.npmjs.com/package/miniapp-plugin-chucker) | Native Mini Program inspector UI, floating button & automated sync CLI |
| [`tarojs-plugin-chucker`](./packages/tarojs-plugin-chucker) | [![npm](https://img.shields.io/npm/v/tarojs-plugin-chucker.svg)](https://www.npmjs.com/package/tarojs-plugin-chucker) | TaroJS compile-time build plugin for Taro React/Vue miniapps |

---

## ✨ Features

- 🛰️ **Automatic Request Interception**: Hooks into `wx.request` / `Taro.request`, `uploadFile`, and `downloadFile`.
- 🔌 **Native Plugin Calls Tracker**: Intercepts `wx.invokeNativePlugin` arguments, callback responses, and error codes.
- 🔍 **Clean Developer UI**: Fast, responsive inspector with status codes, latency, method badges, request/response headers, formatted JSON payloads, and error alerts.
- 📋 **Copy to cURL**: Generate and copy shell-ready cURL commands with one tap.
- 🛠️ **Automated CLI Sync for Native Mini Programs**: `npx miniapp-plugin-chucker` automatically syncs UI assets, configures `app.json`, and injects `<chucker-float />` into page templates.
- 🧹 **Zero-Overhead Production Clean**: Easily strip all inspector UI, routes, and components for release builds with a 0.1 KB no-op stub.
- 📊 **Custom Event Logging (`chuckerStore`)**: Record custom events, WebSocket messages, analytics tracking, and GraphQL queries alongside network calls.

---

## 🚀 Getting Started

### Option A: Using with Taro JS (`tarojs-plugin-chucker`)

#### 1. Install

```bash
pnpm add tarojs-plugin-chucker --save-dev
# or
npm install tarojs-plugin-chucker --save-dev
```

#### 2. Configure Plugin in `config/index.js`

```javascript
// config/index.js
const config = {
  // ...
  plugins: [
    [
      "tarojs-plugin-chucker",
      {
        // Enabled in development by default; set true to force enable
        enabled: process.env.NODE_ENV === "development",
      },
    ],
  ],
};
```

During build, the plugin automatically registers `/pages/chucker/index` in-memory and injects the floating debug button into every compiled page.

---

### Option B: Using with Pure Native Mini Programs (`miniapp-plugin-chucker`)

For native WeChat Mini Programs, TCMPP, Alipay, or ByteDance projects without Taro or React.

#### 1. Install

```bash
npm install miniapp-plugin-chucker --save-dev
# or
pnpm add miniapp-plugin-chucker --save-dev
```

#### 2. Add Scripts to `package.json`

```json
{
  "scripts": {
    "sync": "miniapp-plugin-chucker",
    "clean": "miniapp-plugin-chucker clean"
  }
}
```

#### 3. Run Sync

```bash
npm run sync
```

The CLI automatically:
- Copies inspector UI pages & floating button into `miniprogram_npm/miniapp-plugin-chucker/`.
- Registers `"miniprogram_npm/miniapp-plugin-chucker/pages/chucker/index"` in `app.json` `pages`.
- Registers `"chucker-float"` in `app.json` `usingComponents`.
- Injects `initChucker()` into `app.js`.
- Injects `<chucker-float />` into all page `.wxml` files.

#### 4. Production Clean

When preparing a production release:
```bash
npm run clean
```
This strips Chucker routes, components, WXML tags, and replaces the package with a **0.1 KB no-op stub** for zero bundle overhead.

---

## 📊 Custom Event Logging (`chuckerStore`)

Record custom operations (WebSocket, analytics, GraphQL) into the Chucker timeline using `chuckerStore`:

```typescript
// In Taro:
import { chuckerStore } from "tarojs-plugin-chucker/runtime";

// In Native Mini Programs:
const { chuckerStore } = require("miniapp-plugin-chucker");

// One-shot event logging
chuckerStore.log({
  type: "websocket",
  method: "MESSAGE",
  url: "wss://api.example.com/ws",
  requestData: { event: "ping" },
  status: "success",
  responseData: { event: "pong" },
});

// Async operation tracking with duration calculation
const trackingId = chuckerStore.startTracking({
  type: "graphql",
  method: "QUERY",
  url: "https://api.example.com/graphql",
  requestData: { query: "{ user { id name } }" },
});

// Complete operation later:
chuckerStore.completeTracking(trackingId, {
  status: 200,
  responseData: { data: { user: { id: 1, name: "Alice" } } },
});
```

### `chuckerStore` API Reference

| Method | Returns | Description |
|---|---|---|
| `chuckerStore.log(input)` | `string` (id) | Add a completed log entry |
| `chuckerStore.startTracking(input)` | `string` (id) | Start tracking an async event |
| `chuckerStore.completeTracking(id, result?)` | `void` | Finalize a tracked event |
| `chuckerStore.getLogs()` | `ChuckerLog[]` | Retrieve all current logs |
| `chuckerStore.clear()` | `void` | Clear all logs |
| `chuckerStore.subscribe(listener)` | `() => void` | Subscribe to log updates, returns unsubscribe callback |

---

## 📁 Repository Structure

```
tarojs-plugin-chucker/
├── packages/
│   ├── chucker/                  # miniapp-chucker (core runtime & store)
│   ├── miniapp-plugin-chucker/   # miniapp-plugin-chucker (native inspector UI & CLI)
│   └── tarojs-plugin-chucker/    # tarojs-plugin-chucker (Taro build plugin)
└── example/
    ├── native-plugin-chucker/    # Pure Native WeApp / TCMPP example
    └── taro-app/                 # Taro React example application
```

---

## 🛠️ Monorepo Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9

### Common Commands

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Run Taro example app in watch mode
pnpm dev:weapp

# Sync assets to Native example
pnpm sync:native

# Clean Native example for production
pnpm clean:native

# Lint packages
pnpm lint

# Interactive release & publish (bumpp)
pnpm release
```

---

## 📄 License

[ISC](./LICENSE)
