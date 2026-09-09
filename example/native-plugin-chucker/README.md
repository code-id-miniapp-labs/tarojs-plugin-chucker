# Native Mini Program Example (`native-plugin-chucker`)

This example demonstrates how to integrate `miniapp-plugin-chucker` into a pure **Native WeChat Mini Program / TCMPP / Alipay** project without Taro or React.

---

## 📁 Project Structure

```
example/native-plugin-chucker/
├── app.js                          # Calls initChucker()
├── app.json                        # Registers pages/chucker/index & chucker-float component
├── app.wxss                        # Global styles
├── project.config.json             # WeChat DevTools project config
├── pages/
│   ├── index/                      # Demo page triggering requests
│   │   ├── index.js
│   │   ├── index.json
│   │   ├── index.wxml
│   │   └── index.wxss
│   └── chucker/                    # Native Chucker inspector page
│       ├── index.js
│       ├── index.json
│       ├── index.wxml
│       └── index.wxss
└── components/
    └── chucker-float/              # Native floating debug button custom component
        ├── index.js
        ├── index.json
        ├── index.wxml
        └── index.wxss
```

---

## 🚀 How to Run in WeChat DevTools

1. Install dependencies from the workspace root:
   ```bash
   pnpm install
   pnpm build
   ```

2. Open **WeChat DevTools** (微信开发者工具).
3. Click **Import Project** (导入项目).
4. Select directory:
   ```
   example/native-plugin-chucker
   ```
5. AppID: Use **Test AppID** (`touristappid`) or your own.
6. Click **Import** and view the application running in the simulator!

---

## 💡 How it works

### 1. Initialize Chucker in `app.js`
```js
const { initChucker } = require("miniapp-chucker");

initChucker({
  enabled: true,
  maxLogs: 100,
});
```

### 2. Include the floating button in any page
In `pages/index/index.wxml`:
```xml
<chucker-float />
```

In `pages/index/index.json`:
```json
{
  "usingComponents": {
    "chucker-float": "/components/chucker-float/index"
  }
}
```

### 3. Open Inspector via Code
```js
wx.navigateTo({
  url: "/pages/chucker/index",
});
```
