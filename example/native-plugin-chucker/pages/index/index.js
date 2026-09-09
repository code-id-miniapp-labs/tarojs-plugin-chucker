const { chuckerStore } = require("miniapp-plugin-chucker");

Page({
  data: {
    logsCount: 0,
  },

  onLoad() {
    console.log("Native Index Page Loaded.");
  },

  // 1. HTTP GET Request
  onTriggerGet() {
    wx.request({
      url: "https://httpbin.org/get?user=native-dev&version=1.0",
      method: "GET",
      header: {
        "X-Custom-Header": "Native-Chucker-Demo",
      },
      success(res) {
        console.log("GET success:", res.data);
        wx.showToast({ title: "GET Success", icon: "success" });
      },
      fail(err) {
        console.error("GET failed:", err);
      },
    });
  },

  // 2. HTTP POST Request
  onTriggerPost() {
    wx.request({
      url: "https://httpbin.org/post",
      method: "POST",
      header: {
        "Content-Type": "application/json",
      },
      data: {
        title: "Chucker Native Test",
        timestamp: Date.now(),
        framework: "Native WeApp / TCMPP",
      },
      success(res) {
        console.log("POST success:", res.data);
        wx.showToast({ title: "POST Success", icon: "success" });
      },
      fail(err) {
        console.error("POST failed:", err);
      },
    });
  },

  // 3. HTTP 404 Request (Error simulation)
  onTrigger404() {
    wx.request({
      url: "https://httpbin.org/status/404",
      method: "GET",
      success(res) {
        console.log("404 response received:", res.statusCode);
        wx.showToast({ title: "404 Captured", icon: "none" });
      },
      fail(err) {
        console.error("404 fail:", err);
      },
    });
  },

  // 4. Upload File
  onTriggerUpload() {
    const fs = wx.getFileSystemManager();
    const tempPath = `${wx.env.USER_DATA_PATH}/native_upload_test.txt`;

    fs.writeFile({
      filePath: tempPath,
      data: "Hello from Native WeApp Chucker upload test!",
      encoding: "utf8",
      success() {
        wx.uploadFile({
          url: "https://httpbin.org/post",
          filePath: tempPath,
          name: "file",
          formData: {
            user: "native-user",
            platform: "native-weapp",
          },
          success(res) {
            console.log("Upload success:", res.data);
            wx.showToast({ title: "Upload Success", icon: "success" });
          },
          fail(err) {
            console.error("Upload fail:", err);
          },
        });
      },
      fail(err) {
        console.error("Write temp file failed:", err);
      },
    });
  },

  // 5. Download File
  onTriggerDownload() {
    wx.downloadFile({
      url: "https://httpbin.org/image/png",
      success(res) {
        console.log("Download success, temp file:", res.tempFilePath);
        wx.showToast({ title: "Download Success", icon: "success" });
      },
      fail(err) {
        console.error("Download fail:", err);
      },
    });
  },

  // 6. Native Plugin Call
  onTriggerNativeCall() {
    if (typeof wx.invokeNativePlugin === "function") {
      wx.invokeNativePlugin("demoNativePlugin", { action: "fetchDeviceInfo", env: "staging" }, (res) => {
        console.log("Native plugin result:", res);
      });
    } else {
      // If invokeNativePlugin doesn't exist in simulator, mock one for demo
      chuckerStore.log({
        type: "native",
        method: "NATIVE",
        url: "demoNativePlugin.fetchDeviceInfo",
        requestData: { action: "fetchDeviceInfo", env: "staging" },
        status: "success",
        responseData: { model: "iPhone 15 Pro", os: "iOS 18.0", battery: 95 },
      });
      wx.showToast({ title: "Native Call Logged", icon: "success" });
    }
  },

  // 7. Custom Log entry
  onTriggerCustomLog() {
    chuckerStore.log({
      type: "websocket",
      method: "MESSAGE",
      url: "wss://gateway.example.com/ws/events",
      requestData: { event: "ping", seq: Math.floor(Math.random() * 1000) },
      status: "success",
      responseData: { event: "pong", serverTime: Date.now() },
    });
    wx.showToast({ title: "Custom Log Added", icon: "success" });
  },

  // 8. Open Chucker Page
  onOpenChucker() {
    wx.navigateTo({
      url: "/miniprogram_npm/miniapp-plugin-chucker/pages/chucker/index",
    });
  },

  // 9. Go to Profile Page
  onGoToProfile() {
    wx.navigateTo({
      url: "/pages/profile/index",
    });
  },
});
