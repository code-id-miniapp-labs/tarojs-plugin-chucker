#!/usr/bin/env node
/**
 * miniapp-plugin-chucker CLI
 *
 * Automatically detects enabled/disabled status:
 *   - When enabled: syncs full inspector UI, configures app.json, injects <chucker-float />
 *   - When enabled: false (or clean): strips UI, removes route & replaces with 0.1KB stub
 *
 * Usage:
 *   npx miniapp-plugin-chucker [--root <path>]
 */

import * as fs from "fs";
import * as path from "path";

const args = process.argv.slice(2);
const rootIdx = args.indexOf("--root");
const TARGET_ROOT = rootIdx !== -1 ? path.resolve(args[rootIdx + 1]) : process.cwd();

const PACKAGE_DIST_DIR = path.resolve(__dirname, "..");
const TARGET_NPM_DIR = path.join(TARGET_ROOT, "miniprogram_npm", "miniapp-plugin-chucker");

const CHUCKER_PAGE_ROUTE = "miniprogram_npm/miniapp-plugin-chucker/pages/chucker/index";
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
    addListener: function () { return function () {}; },
    removeListener: function () {},
    destroy: function () {}
  },
  generateCurl: function () { return ""; },
  formatJson: function (v) { return v; }
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

function copyRecursiveSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === "cli" ||
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

  copyRecursiveSync(PACKAGE_DIST_DIR, TARGET_NPM_DIR);
  console.log(`[chucker] 📦 Synced assets -> miniprogram_npm/miniapp-plugin-chucker/`);
  changedCount++;
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
  if (!json.pages.includes(CHUCKER_PAGE_ROUTE)) {
    json.pages.push(CHUCKER_PAGE_ROUTE);
    modified = true;
    console.log(`[chucker] app.json ✅ registered route: "${CHUCKER_PAGE_ROUTE}"`);
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
  const initCode = isTypeScript
    ? `import { initChucker } from "miniapp-plugin-chucker";\ninitChucker({ enabled: true });\n\n`
    : `const { initChucker } = require("miniapp-plugin-chucker");\ninitChucker({ enabled: true });\n\n`;

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
      fs.writeFileSync(file, content.trimEnd() + "\n\n<chucker-float />\n", "utf-8");
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
        const cleaned = content.replace(/\n*<chucker-float\s*\/>\n*/g, "\n").trimEnd() + "\n";
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
