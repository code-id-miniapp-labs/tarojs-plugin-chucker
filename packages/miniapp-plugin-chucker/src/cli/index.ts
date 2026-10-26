#!/usr/bin/env node
/**
 * miniapp-plugin-chucker CLI
 *
 * Automatically detects enabled/disabled status:
 *   - When enabled: syncs full inspector UI, configures app.json, injects <chucker-float />
 *   - When enabled: false (or clean): strips UI, removes route & replaces with 0.1KB stub
 *
 * Usage:
 *   npx miniapp-plugin-chucker [--root <path>] [--main-package] [--sub-root <name>]
 *
 * By default the inspector page is installed as a WeChat/TCMPP sub-package
 * ("<root>/chucker/index"), so only the tiny runtime + float button stay in the main package.
 * Pass --main-package for the legacy layout (page inside miniprogram_npm, main package).
 */

import * as fs from "fs";
import * as path from "path";

const args = process.argv.slice(2);
const rootIdx = args.indexOf("--root");
const TARGET_ROOT = rootIdx !== -1 ? path.resolve(args[rootIdx + 1]) : process.cwd();

const PACKAGE_DIST_DIR = path.resolve(__dirname, "..");
const TARGET_NPM_DIR = path.join(TARGET_ROOT, "miniprogram_npm", "miniapp-plugin-chucker");

const USE_MAIN_PACKAGE = args.includes("--main-package");
const subRootIdx = args.indexOf("--sub-root");
const SUB_ROOT =
  subRootIdx !== -1 && args[subRootIdx + 1]
    ? args[subRootIdx + 1].replace(/^\/+|\/+$/g, "")
    : "chucker";
const SUB_PAGE = "index";
const TARGET_SUB_DIR = path.join(TARGET_ROOT, ...SUB_ROOT.split("/"));
const SUB_MARKER = ".chucker-subpackage";

const LEGACY_PAGE_ROUTE = "miniprogram_npm/miniapp-plugin-chucker/pages/chucker/index";
const CHUCKER_PAGE_ROUTE = USE_MAIN_PACKAGE ? LEGACY_PAGE_ROUTE : `${SUB_ROOT}/${SUB_PAGE}`;
const CHUCKER_COMPONENT_ALIAS = "miniapp-plugin-chucker/components/chucker-float/index";

// Lightweight stub for production (0.1 KB)
const PROD_NOOP_STUB = `"use strict";
// miniapp-plugin-chucker: production no-op stub (0.1 KB)
module.exports = {
  initChucker: function () {},
  chuckerStore: {
    init: function () {},
    log: function () {},
    clear: function () {},
    getLogs: function () { return []; },
    getUnreadCount: function () { return 0; },
    exportText: function () { return ""; },
    subscribe: function () { return function () {}; },
    addListener: function () { return function () {}; },
    removeListener: function () {},
    destroy: function () {}
  },
  generateCurl: function () { return ""; },
  formatJson: function (v) { return v; },
  buildExportText: function () { return ""; }
};
`;

let changedCount = 0;

// Auto-detect if Chucker is disabled in app.js / app.ts or CLI flags
function detectDisabledState(): boolean {
  if (args.includes("clean") || args.includes("--clean") || args.includes("--disable")) {
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    return true;
  }

  const candidateFiles = ["app.js", "app.ts", "app.mjs", "src/app.js", "src/app.ts"];
  for (const filename of candidateFiles) {
    const fullPath = path.join(TARGET_ROOT, filename);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      if (
        /initChucker\s*\(\s*\{[\s\S]*?enabled\s*:\s*false/.test(content) ||
        /enabled\s*:\s*false/.test(content)
      ) {
        console.log(`[chucker] 🔍 Detected 'enabled: false' in ${filename}`);
        return true;
      }
    }
  }

  return false;
}

function copyRecursiveSync(src: string, dest: string, skip: string[] = []) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === "cli" ||
      skip.indexOf(entry.name) !== -1 ||
      entry.name.endsWith(".tsbuildinfo") ||
      entry.name.endsWith(".map")
    ) {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function syncPackage() {
  if (fs.existsSync(TARGET_NPM_DIR)) {
    fs.rmSync(TARGET_NPM_DIR, { recursive: true, force: true });
  }

  // In sub-package mode the inspector page is NOT copied into miniprogram_npm (main package).
  copyRecursiveSync(PACKAGE_DIST_DIR, TARGET_NPM_DIR, USE_MAIN_PACKAGE ? [] : ["pages"]);
  console.log(`[chucker] 📦 Synced runtime -> miniprogram_npm/miniapp-plugin-chucker/`);
  changedCount++;

  if (!USE_MAIN_PACKAGE) syncSubPackage();
}

function syncSubPackage() {
  const pageSrc = path.join(PACKAGE_DIST_DIR, "pages", "chucker");
  if (!fs.existsSync(pageSrc)) {
    console.error(`[chucker] ❌ Inspector page not found in package dist: ${pageSrc}`);
    return;
  }
  if (fs.existsSync(TARGET_SUB_DIR)) {
    if (!fs.existsSync(path.join(TARGET_SUB_DIR, SUB_MARKER))) {
      console.error(
        `[chucker] ❌ "${SUB_ROOT}/" already exists and was not created by chucker. ` +
          `Use --sub-root <otherName> to pick another folder.`,
      );
      process.exit(1);
    }
    fs.rmSync(TARGET_SUB_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TARGET_SUB_DIR, { recursive: true });
  for (const f of fs.readdirSync(pageSrc)) {
    const ext = path.extname(f);
    if (f.endsWith(".map")) continue;
    fs.copyFileSync(path.join(pageSrc, f), path.join(TARGET_SUB_DIR, SUB_PAGE + ext));
  }
  fs.writeFileSync(
    path.join(TARGET_SUB_DIR, SUB_MARKER),
    "Generated by miniapp-plugin-chucker. Safe to delete via `miniapp-plugin-chucker clean`.\n",
  );
  console.log(`[chucker] 📦 Synced inspector page -> ${SUB_ROOT}/ (sub-package)`);
  changedCount++;
}

function getSubKey(json: any): "subPackages" | "subpackages" {
  return Array.isArray(json.subpackages) && !Array.isArray(json.subPackages)
    ? "subpackages"
    : "subPackages";
}

function patchAppJson() {
  const appJsonPath = path.join(TARGET_ROOT, "app.json");
  if (!fs.existsSync(appJsonPath)) return;

  let json: any;
  try {
    json = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
  } catch (err) {
    console.error(`[chucker] ❌ Failed to parse app.json:`, err);
    return;
  }

  let modified = false;

  if (!Array.isArray(json.pages)) {
    json.pages = [];
  }
  if (USE_MAIN_PACKAGE) {
    if (!json.pages.includes(CHUCKER_PAGE_ROUTE)) {
      json.pages.push(CHUCKER_PAGE_ROUTE);
      modified = true;
      console.log(`[chucker] app.json ✅ registered route: "${CHUCKER_PAGE_ROUTE}"`);
    }
  } else {
    // Migrate: drop legacy main-package route
    const before = json.pages.length;
    json.pages = json.pages.filter((p: string) => p !== LEGACY_PAGE_ROUTE);
    if (json.pages.length !== before) {
      modified = true;
      console.log(`[chucker] app.json 🔁 removed legacy main-package route`);
    }
    const key = getSubKey(json);
    if (!Array.isArray(json[key])) json[key] = [];
    const existing = json[key].find((p: any) => p && p.root === SUB_ROOT);
    if (!existing) {
      json[key].push({ root: SUB_ROOT, pages: [SUB_PAGE] });
      modified = true;
      console.log(`[chucker] app.json ✅ registered sub-package: "${SUB_ROOT}" (route "/${CHUCKER_PAGE_ROUTE}")`);
    } else if (!Array.isArray(existing.pages) || !existing.pages.includes(SUB_PAGE)) {
      existing.pages = [...(existing.pages || []), SUB_PAGE];
      modified = true;
    }
  }

  if (!json.usingComponents) {
    json.usingComponents = {};
  }
  if (!json.usingComponents["chucker-float"]) {
    json.usingComponents["chucker-float"] = CHUCKER_COMPONENT_ALIAS;
    modified = true;
    console.log(`[chucker] app.json ✅ registered component: "chucker-float"`);
  }

  if (modified) {
    fs.writeFileSync(appJsonPath, JSON.stringify(json, null, 2) + "\n", "utf-8");
    changedCount++;
  }
}

function patchAppEntry() {
  const candidateFiles = ["app.js", "app.ts", "app.mjs", "src/app.js", "src/app.ts"];
  let appEntryPath: string | null = null;

  for (const filename of candidateFiles) {
    const fullPath = path.join(TARGET_ROOT, filename);
    if (fs.existsSync(fullPath)) {
      appEntryPath = fullPath;
      break;
    }
  }

  if (!appEntryPath) return;

  const content = fs.readFileSync(appEntryPath, "utf-8");
  if (content.includes("initChucker") || content.includes("miniapp-plugin-chucker")) {
    return;
  }

  const isTypeScript = appEntryPath.endsWith(".ts");
  const navOpt = USE_MAIN_PACKAGE ? "" : `, navigatePath: "/${CHUCKER_PAGE_ROUTE}"`;
  const initCode = isTypeScript
    ? `import { initChucker } from "miniapp-plugin-chucker";\ninitChucker({ enabled: true${navOpt} });\n\n`
    : `const { initChucker } = require("miniapp-plugin-chucker");\ninitChucker({ enabled: true${navOpt} });\n\n`;

  fs.writeFileSync(appEntryPath, initCode + content, "utf-8");
  console.log(`[chucker] ${path.basename(appEntryPath)} ✅ injected initChucker()`);
  changedCount++;
}

function injectComponentIntoPageWxml() {
  const pagesDir = path.join(TARGET_ROOT, "pages");
  if (!fs.existsSync(pagesDir)) return;

  function scanWxml(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "chucker") {
          results.push(...scanWxml(full));
        }
      } else if (entry.isFile() && /\.(wxml|axml|ttml|swan|qml)$/.test(entry.name)) {
        results.push(full);
      }
    }
    return results;
  }

  const wxmlFiles = scanWxml(pagesDir);
  for (const file of wxmlFiles) {
    const content = fs.readFileSync(file, "utf-8");
    if (!content.includes("chucker-float")) {
      const tag = USE_MAIN_PACKAGE ? "<chucker-float />" : `<chucker-float url="/${CHUCKER_PAGE_ROUTE}" />`;
      fs.writeFileSync(file, content.trimEnd() + "\n\n" + tag + "\n", "utf-8");
      console.log(`[chucker] ${path.relative(TARGET_ROOT, file)} ✅ injected <chucker-float />`);
      changedCount++;
    }
  }
}

function cleanProduction() {
  console.log(`[chucker] 🧹 Auto-cleaning Chucker for production (0 KB UI footprint)...`);

  // 1. Replace miniprogram_npm/miniapp-plugin-chucker with tiny no-op stub
  if (fs.existsSync(TARGET_NPM_DIR)) {
    fs.rmSync(TARGET_NPM_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TARGET_NPM_DIR, { recursive: true });
  fs.writeFileSync(path.join(TARGET_NPM_DIR, "index.js"), PROD_NOOP_STUB, "utf-8");
  console.log(
    `[chucker] 📄 Replaced miniprogram_npm/miniapp-plugin-chucker with tiny no-op stub (0.1 KB)`,
  );
  changedCount++;

  // 1b. Remove generated sub-package folder (only if we created it)
  if (fs.existsSync(path.join(TARGET_SUB_DIR, SUB_MARKER))) {
    fs.rmSync(TARGET_SUB_DIR, { recursive: true, force: true });
    console.log(`[chucker] 🗑️ Removed sub-package folder ${SUB_ROOT}/`);
    changedCount++;
  }

  // 2. Remove route and usingComponents from app.json
  const appJsonPath = path.join(TARGET_ROOT, "app.json");
  if (fs.existsSync(appJsonPath)) {
    try {
      const json = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
      let modified = false;

      if (Array.isArray(json.pages)) {
        const origLen = json.pages.length;
        json.pages = json.pages.filter((p: string) => !p.includes("chucker"));
        if (json.pages.length !== origLen) modified = true;
      }

      for (const key of ["subPackages", "subpackages"]) {
        if (Array.isArray(json[key])) {
          const before = json[key].length;
          json[key] = json[key].filter((p: any) => !(p && p.root === SUB_ROOT));
          if (json[key].length !== before) modified = true;
          if (json[key].length === 0) delete json[key];
        }
      }

      if (json.usingComponents && json.usingComponents["chucker-float"]) {
        delete json.usingComponents["chucker-float"];
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(appJsonPath, JSON.stringify(json, null, 2) + "\n", "utf-8");
        console.log(`[chucker] 🗑️ Removed Chucker route & components from app.json`);
        changedCount++;
      }
    } catch (e) {}
  }

  // 3. Strip <chucker-float /> from all page WXMLs
  const pagesDir = path.join(TARGET_ROOT, "pages");
  if (fs.existsSync(pagesDir)) {
    function scanWxml(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...scanWxml(full));
        } else if (entry.isFile() && /\.(wxml|axml|ttml|swan|qml)$/.test(entry.name)) {
          results.push(full);
        }
      }
      return results;
    }

    const wxmlFiles = scanWxml(pagesDir);
    for (const file of wxmlFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("chucker-float")) {
        const cleaned =
          content.replace(/\n*<chucker-float\b[^>]*\/>\n*/g, "\n").trimEnd() + "\n";
        fs.writeFileSync(file, cleaned, "utf-8");
        console.log(
          `[chucker] 🗑️ Stripped <chucker-float /> from ${path.relative(TARGET_ROOT, file)}`,
        );
        changedCount++;
      }
    }
  }

  console.log(`[chucker] 🚀 Production clean complete! All UI stripped, zero error requires.`);
}

const isDisabled = detectDisabledState();

console.log("================================================");
console.log(`  🚀 miniapp-plugin-chucker ${isDisabled ? "(DISABLED / CLEAN)" : "(ENABLED)"}`);
console.log("================================================");

if (isDisabled) {
  cleanProduction();
} else {
  syncPackage();
  patchAppJson();
  patchAppEntry();
  injectComponentIntoPageWxml();
  console.log(`[chucker] ✨ Ready to run in WeChat DevTools!`);
}

console.log("================================================");
