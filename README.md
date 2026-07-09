# tarojs-plugin-chucker

A Chucker-like debugger plugin for Taro JS miniapps. It intercepts, logs, and displays network requests and native plugin calls (`wx.invokeNativePlugin`) directly in your miniapp during QA/Testing.

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
    ['tarojs-plugin-chucker', {
      // By default, only enabled in development. Set true to force enable.
      enabled: process.env.NODE_ENV === 'development'
    }]
  ]
}
```

### 2. Zero Code Initialization

You do **not** need to manually import or call `initChucker()` inside your `src/app.tsx` file. The compile-time plugin automatically injects the runtime initialization and hooks into the app entry point dynamically at build time!

Simply registering the plugin in your `config/index.js` is sufficient. 

*Note: You do not need to add any layout code or components to your pages. The plugin automatically injects the floating trigger bubble (`🪲`) onto every page.*

---

## Dedicated Debugger Page

To navigate to the debugger manually (e.g., from custom menus or gestures):

```typescript
import Taro from '@tarojs/taro';

Taro.navigateTo({ url: '/pages/chucker/index' });
```

---

## Running Unit Tests

Unit tests are written using Jest and can be executed via:

```bash
pnpm run test
```

---

## Running the Example Application

There is a fully configured example Taro project located in the `example/` directory:

1. Navigate to the example folder:
   ```bash
   cd example
   ```
2. Install example dependencies (which links to the local package workspace):
   ```bash
   pnpm install
   ```
3. Run the development server (for WeChat mini-programs target):
   ```bash
   pnpm run dev:weapp
   ```

---

## Publishing to npm

To publish this package to the npm registry:

1. Log in to your npm account (if not already logged in):
   ```bash
   npm login
   ```
2. Build the project and publish:
   ```bash
   pnpm publish
   ```
   *The package is pre-configured with `"files": ["dist"]` in `package.json` to publish only compiled JavaScript artifacts.*
