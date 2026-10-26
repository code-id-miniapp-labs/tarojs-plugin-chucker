import { IPluginContext } from "@tarojs/service";
import * as path from "path";
import * as fs from "fs";

export interface ChuckerPluginOptions {
  /**
   * Whether Chucker should be active.
   * Defaults to `process.env.NODE_ENV === "development"` when not specified.
   */
  enabled?: boolean;
  /**
   * Register the inspector page as an independent sub-package instead of a
   * main-package page, so its UI code does not count toward the main package size.
   * - `true` (default): sub-package root "chucker"  → route "/chucker/index"
   * - `string`: custom sub-package root             → route "/<root>/index"
   * - `false`: legacy behaviour, main-package page  → route "/pages/chucker/index"
   */
  subPackage?: boolean | string;
}

function resolveLayout(options: ChuckerPluginOptions) {
  const sp = options.subPackage === undefined ? true : options.subPackage;
  if (sp === false) {
    return { isSub: false, root: "", pagePath: "pages/chucker/index" };
  }
  const root = typeof sp === "string" && sp.trim() ? sp.trim().replace(/^\/+|\/+$/g, "") : "chucker";
  return { isSub: true, root, pagePath: `${root}/index` };
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
  const layout = resolveLayout(options);
  ctx.modifyAppConfig(({ appConfig }) => {
    const isDev = process.env.NODE_ENV === "development";
    const enabled = options.enabled !== undefined ? options.enabled : isDev;
    if (!enabled) return;

    if (!appConfig) return;
    const cfg: any = appConfig;

    if (!layout.isSub) {
      if (cfg.pages && !cfg.pages.includes(layout.pagePath)) {
        cfg.pages.push(layout.pagePath);
        console.log(`[tarojs-plugin-chucker] Registered main-package page "${layout.pagePath}"`);
      }
      return;
    }

    // Sub-package mode: keep inspector UI out of the main package.
    const key = Array.isArray(cfg.subpackages) && !Array.isArray(cfg.subPackages) ? "subpackages" : "subPackages";
    if (!Array.isArray(cfg[key])) cfg[key] = [];
    const exists = cfg[key].some((p: any) => p && p.root === layout.root);
    if (!exists) {
      cfg[key].push({ root: layout.root, pages: ["index"] });
      console.log(
        `[tarojs-plugin-chucker] Registered sub-package "${layout.root}" (route "/${layout.pagePath}")`,
      );
    }
    // Remove a stale legacy main-package entry if someone added it manually.
    if (Array.isArray(cfg.pages)) {
      cfg.pages = cfg.pages.filter((p: string) => p !== "pages/chucker/index");
    }
  });

  ctx.modifyWebpackChain(({ chain }) => {
    const isDev = process.env.NODE_ENV === "development";
    const enabled = options.enabled !== undefined ? options.enabled : isDev;

    chain.plugin("definePlugin").tap((args: any[]) => {
      if (args && args[0]) {
        args[0]["process.env.CHUCKER_ENABLED"] = JSON.stringify(enabled);
        args[0]["process.env.CHUCKER_ROUTE"] = JSON.stringify("/" + layout.pagePath);
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
      const userPagePathWin = path.join(ctx.paths.sourcePath, ...layout.pagePath.split("/"));
      const userPagePathUnix = userPagePathWin.replace(/\\/g, "/");

      chain.resolve.alias
        .set(layout.pagePath, templatePath)
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
      // 2. Patch the inspector page JSON with nav bar config
      if (filename === `${layout.pagePath}.json`) {
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
        !filename.startsWith(`${layout.pagePath}`) &&
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
          const newContent = content + `\n<chucker-float url="/${layout.pagePath}" />\n`;
          assets[filename] = createRawSource(newContent);
        }
      }
    });
  });
};


