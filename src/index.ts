import { IPluginContext } from "@tarojs/service";
import * as path from "path";
import * as fs from "fs";

export interface ChuckerPluginOptions {
  enabled?: boolean;
}

export default (ctx: IPluginContext, options: ChuckerPluginOptions = {}) => {
  ctx.modifyAppConfig(({ appConfig }) => {
    const isDev = process.env.NODE_ENV === "development";
    const enabled = options.enabled !== undefined ? options.enabled : isDev;
    if (!enabled) return;

    if (appConfig && appConfig.pages) {
      if (!appConfig.pages.includes("pages/chucker/index")) {
        appConfig.pages.push("pages/chucker/index");
        console.log('[Taro Chucker] Dynamically registered "pages/chucker/index" page');
      }
    }
  });

  ctx.modifyWebpackChain(({ chain }) => {
    const isDev = process.env.NODE_ENV === "development";
    const enabled = options.enabled !== undefined ? options.enabled : isDev;

    chain.plugin("definePlugin").tap((args: any[]) => {
      if (args && args[0]) {
        args[0]["process.env.CHUCKER_ENABLED"] = JSON.stringify(enabled);
      }
      return args;
    });

    if (enabled) {
      // Find the actual app entry file under sourcePath
      const sourcePath = ctx.paths.sourcePath;
      const entryFiles = ["app.ts", "app.tsx", "app.js", "app.jsx"];
      let appEntryFile = "";
      for (const file of entryFiles) {
        const fullPath = path.join(sourcePath, file);
        if (fs.existsSync(fullPath)) {
          appEntryFile = fullPath;
          break;
        }
      }

      // Setup Webpack aliases to virtualize pages/chucker/index page resolution
      const userPagePathWin = path.join(ctx.paths.sourcePath, "pages", "chucker", "index");
      const userPagePathUnix = userPagePathWin.replace(/\\/g, "/");
      const templatePath = path.resolve(__dirname, "runtime", "page.js");

      chain.resolve.alias
        .set("pages/chucker/index", templatePath)
        .set(userPagePathWin, templatePath)
        .set(userPagePathWin + ".tsx", templatePath)
        .set(userPagePathWin + ".ts", templatePath)
        .set(userPagePathWin + ".js", templatePath)
        .set(userPagePathWin + ".jsx", templatePath)
        .set(userPagePathUnix, templatePath)
        .set(userPagePathUnix + ".tsx", templatePath)
        .set(userPagePathUnix + ".ts", templatePath)
        .set(userPagePathUnix + ".js", templatePath)
        .set(userPagePathUnix + ".jsx", templatePath);

      // Force resolve React, Taro, and Taro components from the host project's node_modules
      // to prevent duplicate library instances (e.g. invalid hook call with useState).
      const hostNodeModules =
        ctx.paths.nodeModulesPath || path.resolve(ctx.paths.appPath, "node_modules");
      if (hostNodeModules) {
        const reactPath = path.resolve(hostNodeModules, "react");
        if (fs.existsSync(reactPath)) {
          chain.resolve.alias.set("react", reactPath);
        }
        const taroPath = path.resolve(hostNodeModules, "@tarojs/taro");
        if (fs.existsSync(taroPath)) {
          chain.resolve.alias.set("@tarojs/taro", taroPath);
        }
        const componentsPath = path.resolve(hostNodeModules, "@tarojs/components");
        if (fs.existsSync(componentsPath)) {
          chain.resolve.alias.set("@tarojs/components", componentsPath);
        }
      }

      chain.module
        .rule("chucker-app-injector")
        .test((resourcePath: string) => {
          if (!resourcePath || !appEntryFile) return false;
          const absoluteResource = path.resolve(resourcePath);
          const normalizedResource = absoluteResource.replace(/\\/g, "/");
          const normalizedEntryPath = appEntryFile.replace(/\\/g, "/");
          const resPathNoExt = normalizedResource.replace(/\.[a-zA-Z0-9]+$/, "");
          const entryPathNoExt = normalizedEntryPath.replace(/\.[a-zA-Z0-9]+$/, "");
          const isJsOrTs = /\.(ts|tsx|js|jsx)$/.test(resourcePath);
          const isMatch = resPathNoExt === entryPathNoExt && isJsOrTs;
          if (normalizedResource.includes("app.") || isMatch) {
            console.log(
              `[Taro Chucker] Matching: ${normalizedResource} vs ${normalizedEntryPath} -> ${isMatch}`,
            );
          }
          return isMatch;
        })
        .use("chucker-loader")
        .loader(path.resolve(__dirname, "loader.js"))
        .end();
    }
  });

  ctx.modifyBuildAssets(({ assets }) => {
    const isDev = process.env.NODE_ENV === "development";
    const enabled = options.enabled !== undefined ? options.enabled : isDev;
    if (!enabled) return;

    Object.keys(assets).forEach((filename) => {
      // 1. Inject page configuration dynamically into pages/chucker/index.json
      if (filename === "pages/chucker/index.json") {
        const asset = assets[filename];
        const originalSource = asset.source();
        const content =
          typeof originalSource === "string" ? originalSource : originalSource.toString();
        try {
          const config = JSON.parse(content);
          config.navigationBarTitleText = "Chucker";
          config.navigationBarBackgroundColor = "#121212";
          config.navigationBarTextStyle = "white";
          config.backgroundColor = "#121212";

          const newContent = JSON.stringify(config);
          assets[filename] = {
            source: () => newContent,
            size: () => newContent.length,
          } as any;
        } catch (err) {
          console.error("🚀 [Taro Chucker] Failed to modify chucker page config:", err);
        }
      }

      // 2. Inject WXML float button to all page templates (except Chucker page itself)
      const isPageTemplate =
        filename.startsWith("pages/") &&
        /\.(wxml|axml|ttml|swan|qml)$/.test(filename) &&
        !filename.includes("pages/chucker/");

      if (isPageTemplate) {
        const asset = assets[filename];
        const originalSource = asset.source();
        const content =
          typeof originalSource === "string" ? originalSource : originalSource.toString();

        if (!content.includes("chucker-float-btn")) {
          const wxmlSnippet = '\n<view class="chucker-float-btn" bindtap="chuckerTap">C</view>\n';
          const newContent = content + wxmlSnippet;

          assets[filename] = {
            source: () => newContent,
            size: () => newContent.length,
          } as any;
        }
      }

      // 2. Inject styles to main style sheets (app.wxss / app.acss / etc.)
      const isAppStylesheet = /^app\.(wxss|acss|css|ttss|qss)$/.test(filename);

      if (isAppStylesheet) {
        const asset = assets[filename];
        const originalSource = asset.source();
        const content =
          typeof originalSource === "string" ? originalSource : originalSource.toString();

        if (!content.includes(".chucker-float-btn")) {
          const styles = `
.chucker-float-btn {
  position: fixed !important;
  bottom: calc(env(safe-area-inset-bottom) + 200rpx) !important;
  right: 15px !important;
  width: 46px !important;
  height: 46px !important;
  border-radius: 23px !important;
  color: white;
  background-color: rgba(30, 30, 30, 0.85) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 99999 !important;
  font-size: 20px !important;
}
`;
          const newContent = content + styles;

          assets[filename] = {
            source: () => newContent,
            size: () => newContent.length,
          } as any;
        }
      }
    });
  });
};
