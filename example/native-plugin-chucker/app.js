// Initialize Chucker from single bundled miniapp-plugin-chucker package
const { initChucker } = require("miniapp-plugin-chucker");

initChucker({
  enabled: true,
  maxLogs: 100,
  console: true,
});

App({
  onLaunch() {
    console.log("Native Chucker Demo launched.");
  },
});
