import { IPluginContext } from "@tarojs/service";
import * as path from "path";
import * as fs from "fs";

export interface ChuckerPluginOptions {
  /**
   * Whether Chucker should be active.
   * Defaults to `process.env.NODE_ENV === "development"` when not specified.
   */
  enabled?: boolean;
}

function createRawSource(content: string) {
  const buf = Buffer.from(content, "utf-8");
  return {
    source: () => content,
    size: () => buf.length,
    buffer: () => buf,
    map: () => null,
    sourceAndMap: () => ({ source: content, map: null }),
    updateHash: (hash: any) => hash.update(buf),
  } as any;
}

export default (ctx: IPluginContext, options: ChuckerPluginOptions = {}) => {
  ctx.modifyAppConfig(({ appConfig }) => {
    const isDev = process.env.NODE_ENV === "development";
    const enabled = options.enabled !== undefined ? options.enabled : isDev;
    if (!enabled) return;

    if (appConfig && appConfig.pages) {
      if (!appConfig.pages.includes("pages/chucker/index")) {
        appConfig.pages.push("pages/chucker/index");
        console.log('[tarojs-plugin-chucker] Dynamically registered "pages/chucker/index" page');
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

      // Use the React/TSX page bundled inside tarojs-plugin-chucker for Taro builds.
      // The native WXML page in miniapp-chucker is only used by native WeApp/TCMPP.
      const templatePath = path.resolve(__dirname, "runtime", "page.js");

      // Resolve host node_modules for de-duplicating React/Taro instances
      const hostNodeModules =
        ctx.paths.nodeModulesPath || path.resolve(ctx.paths.appPath, "node_modules");

      // Setup Webpack aliases to virtualize pages/chucker/index page resolution
      const userPagePathWin = path.join(ctx.paths.sourcePath, "pages", "chucker", "index");
      const userPagePathUnix = userPagePathWin.replace(/\\/g, "/");

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

      // Alias miniapp-chucker to plugin's own dependency so host app does not need to install it
      try {
        const miniappChuckerPath = require.resolve("miniapp-chucker");
        chain.resolve.alias.set("miniapp-chucker$", miniappChuckerPath);
        chain.resolve.alias.set("miniapp-chucker", miniappChuckerPath);
      } catch (_e) {}

      // Force resolve from host project's node_modules to prevent duplicates
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

      // Inject initChucker() into the host app entry via webpack loader
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
          return resPathNoExt === entryPathNoExt && isJsOrTs;
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

    // Path to the pre-built custom component source files
    const componentSrcDir = path.resolve(__dirname, "components", "chucker-float");
    const componentDistPath = "components/chucker-float";

    // 1. Emit the custom component files into the build output
    const componentFiles = ["index.js", "index.json", "index.wxml", "index.wxss"];
    componentFiles.forEach((file) => {
      const srcFile = path.join(componentSrcDir, file);
      const distKey = `${componentDistPath}/${file}`;
      if (fs.existsSync(srcFile) && !assets[distKey]) {
        const content = fs.readFileSync(srcFile, "utf-8");
        assets[distKey] = createRawSource(content);
      }
    });

    Object.keys(assets).forEach((filename) => {
      // 2. Patch pages/chucker/index.json with nav bar config
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
          assets[filename] = createRawSource(newContent);
        } catch (err) {
          console.error("[tarojs-plugin-chucker] Failed to modify chucker page config:", err);
        }
      }

      // 3. Register the chucker-float component in each page's JSON config
      const isPageJson =
        filename.startsWith("pages/") &&
        filename.endsWith(".json") &&
        !filename.includes("pages/chucker/");

      if (isPageJson) {
        const asset = assets[filename];
        const originalSource = asset.source();
        const content =
          typeof originalSource === "string" ? originalSource : originalSource.toString();
        try {
          const config = JSON.parse(content);
          if (!config.usingComponents) config.usingComponents = {};
          if (!config.usingComponents["chucker-float"]) {
            config.usingComponents["chucker-float"] = `/${componentDistPath}/index`;
            const newContent = JSON.stringify(config);
            assets[filename] = createRawSource(newContent);
          }
        } catch (err) {
          console.error("[tarojs-plugin-chucker] Failed to patch page JSON:", filename, err);
        }
      }

      // 4. Inject <chucker-float/> into every page WXML (except the Chucker page itself)
      const isPageTemplate =
        filename.startsWith("pages/") &&
        /\.(wxml|axml|ttml|swan|qml)$/.test(filename) &&
        !filename.includes("pages/chucker/");

      if (isPageTemplate) {
        const asset = assets[filename];
        const originalSource = asset.source();
        const content =
          typeof originalSource === "string" ? originalSource : originalSource.toString();

        if (!content.includes("chucker-float")) {
          // Append the component tag at the end of the WXML
          const newContent = content + "\n<chucker-float />\n";
          assets[filename] = createRawSource(newContent);
        }
      }
    });
  });
};


