# Native Mini Program Example (`native-plugin-chucker`)

This example demonstrates how to integrate `miniapp-plugin-chucker` into a pure **Native WeChat Mini Program / TCMPP / Alipay** project without Taro or React.

All asset synchronization, `app.json` configuration, script injection, and floating debugger component attachment are automated via the `miniapp-plugin-chucker` CLI script.

---

## 📁 Project Structure

```
example/native-plugin-chucker/
├── app.js                          # Initializes initChucker()
├── app.json                        # App configuration (routes & components)
├── app.wxss                        # Global styles
├── package.json                    # Contains sync & clean scripts
├── project.config.json             # WeChat DevTools project configuration
├── pages/
│   ├── index/                      # Demo page triggering requests, uploads & native calls
│   │   ├── index.js
│   │   ├── index.json
│   │   ├── index.wxml
│   │   └── index.wxss
│   └── profile/                    # Secondary page demonstrating persistent floating button
│       ├── index.js
│       ├── index.json
│       ├── index.wxml
│       └── index.wxss
└── miniprogram_npm/                # ⚡ Generated automatically by `pnpm run sync`
    └── miniapp-plugin-chucker/     # Synced Chucker assets (pages, components, runtime)
```

> **Note**: `miniprogram_npm/miniapp-plugin-chucker/` is synced and managed automatically by the CLI script (`pnpm run sync`). You do not need to manually copy inspector pages or components.

---

## 🚀 How to Run in WeChat DevTools

### 1. Build packages and sync assets

From the workspace root:
```bash
# Install dependencies and build all packages
pnpm install
pnpm build

# Sync Chucker assets and inject configurations into this example
pnpm sync:native
```

*(Alternatively, run `pnpm run sync` directly inside `example/native-plugin-chucker/`)*

### 2. Import into WeChat DevTools

1. Open **WeChat DevTools** (微信开发者工具).
2. Click **Import Project** (导入项目).
3. Select directory:
   ```
   example/native-plugin-chucker
   ```
4. AppID: Use **Test AppID** (`touristappid`) or your own developer AppID.
5. Click **Import** and view the application running in the simulator!

---

## 📜 Available Scripts

Inside `example/native-plugin-chucker/`:

| Script | Command | Description |
|---|---|---|
| `pnpm run sync` | `miniapp-plugin-chucker` | Syncs Chucker UI assets into `miniprogram_npm/`, registers route & components in `app.json`, and injects `<chucker-float />` into page WXML templates. |
| `pnpm run clean` | `miniapp-plugin-chucker clean` | **Production cleanup**: Strips Chucker routes and components from `app.json`, removes `<chucker-float />` from WXML, and replaces `miniprogram_npm` with a tiny 0.1 KB no-op stub for 0 KB footprint. |

---

## 💡 How It Works

### 1. Automatic Asset & Route Injection (`pnpm run sync`)

Running `pnpm run sync` executes the `miniapp-plugin-chucker` CLI, which automatically performs:

- **Asset Sync**: Copies runtime inspector pages and components into `miniprogram_npm/miniapp-plugin-chucker/`.
- **Route Registration**: Adds `"miniprogram_npm/miniapp-plugin-chucker/pages/chucker/index"` to `app.json`'s `pages` list.
- **Global Component Registration**: Configures `"chucker-float": "miniapp-plugin-chucker/components/chucker-float/index"` in `app.json` `usingComponents`.
- **WXML Injection**: Adds `<chucker-float />` to all page `.wxml` templates.
- **Entry Setup**: Ensures `initChucker()` is called in `app.js`.

### 2. Initialization in `app.js`

```javascript
const { initChucker } = require("miniapp-plugin-chucker");

initChucker({
  enabled: true,
  maxLogs: 100,
});

App({
  onLaunch() {
    console.log("Native Chucker Demo launched.");
  },
});
```

### 3. Floating Debugger Button

Because `chucker-float` is globally registered in `app.json` and injected into page WXML files:

```xml
<!-- Injected at the bottom of pages/index/index.wxml & pages/profile/index.wxml -->
<chucker-float />
```

A draggable, unread-badged Chucker button appears on every page. Tapping it opens the debugger overlay page.

### 4. Opening Inspector via Code

You can also navigate to the Chucker inspector programmatically:

```javascript
wx.navigateTo({
  url: "/miniprogram_npm/miniapp-plugin-chucker/pages/chucker/index",
});
```

### 5. Custom Event Logging via `chuckerStore`

In addition to automatic network (`wx.request`, `wx.uploadFile`, `wx.downloadFile`) and native plugin (`wx.invokeNativePlugin`) interception, record custom logs or WebSocket messages anytime:

```javascript
const { chuckerStore } = require("miniapp-plugin-chucker");

// Record custom event / WebSocket log
chuckerStore.log({
  type: "websocket",
  method: "MESSAGE",
  url: "wss://gateway.example.com/ws/events",
  requestData: { event: "ping" },
  status: "success",
  responseData: { event: "pong" },
});
```

---

## 🧹 Production Release (Zero Overhead)

To prepare for production:

```bash
pnpm run clean
```

Or configure `enabled: false` in `app.js` / run with `NODE_ENV=production`. The CLI strips all Chucker UI routes, components, and replaces the library with a **0.1 KB no-op stub** so no debug code or UI assets end up in your release bundle.
