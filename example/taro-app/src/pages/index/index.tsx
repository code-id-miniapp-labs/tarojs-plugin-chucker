import React from "react";
import { View, Text, Button } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import "./index.scss";

export default function Index() {
  useLoad(() => {
    console.log("Page loaded.");
  });

  const triggerRequest = () => {
    Taro.request({
      url: "https://httpbin.org/get",
      method: "GET",
      data: { test: "taro-chucker-v4" },
      success: (res) => {
        console.log("Request success:", res.data);
      },
    });
  };

  const triggerUpload = () => {
    try {
      const fs = Taro.getFileSystemManager ? Taro.getFileSystemManager() : null;
      const tempPath = `${Taro.env.USER_DATA_PATH}/test_upload.txt`;
      if (fs) {
        fs.writeFile({
          filePath: tempPath,
          data: "Hello from Chucker upload test payload!",
          encoding: "utf8",
          success: () => {
            Taro.uploadFile({
              url: "https://httpbin.org/post",
              filePath: tempPath,
              name: "file",
              formData: { user: "test-v4" },
              success: (res) => {
                console.log("Upload success:", res.data);
              },
              fail: (err) => {
                console.log("Upload completed with fail:", err);
              },
            });
          },
          fail: (err) => {
            console.error("Write temp file failed:", err);
          },
        });
      } else {
        Taro.uploadFile({
          url: "https://httpbin.org/post",
          filePath: "test.txt",
          name: "file",
          formData: { user: "test-v4" },
          success: (res) => console.log("Upload success:", res),
          fail: (err) => console.log("Upload fail:", err),
        });
      }
    } catch (e) {
      console.error("Upload error:", e);
    }
  };

  const triggerNativeCall = () => {
    // @ts-ignore
    const globalObj = typeof wx !== "undefined" ? wx : typeof my !== "undefined" ? my : null;
    if (globalObj && typeof globalObj.invokeNativePlugin === "function") {
      globalObj.invokeNativePlugin("testPlugin", { arg1: "hello-v4" }, (res) => {
        console.log("Native plugin response:", res);
      });
    } else {
      Taro.showToast({ title: "Not in Miniprogram", icon: "none" });
    }
  };

  const goToChucker = () => {
    Taro.navigateTo({ url: "/pages/chucker/index" });
  };

  return (
    <View style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "15px" }}>
      <Text style={{ fontSize: "20px", fontWeight: "bold" }}>Taro Chucker Example (Taro v4)</Text>
      <Text style={{ color: "#666", fontSize: "14px" }}>
        Click the buttons below to trigger network/native requests and observe them in Chucker.
      </Text>

      <Button onClick={triggerRequest} type="primary">
        Trigger HTTP Request (GET)
      </Button>
      <Button onClick={triggerUpload}>Trigger Upload Request</Button>
      <Button onClick={triggerNativeCall}>Trigger Native Plugin Call</Button>

      <Button
        onClick={goToChucker}
        style={{ marginTop: "20px", backgroundColor: "#34c759", color: "#fff" }}
      >
        Open Chucker Console
      </Button>
    </View>
  );
}
