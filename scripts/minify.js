const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

// Safe WXSS minifier that preserves WeChat-specific syntax (rpx, standard rgba colors)
function minifyWxss(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove comments
    .replace(/\s*([\{\}:;,])\s*/g, "$1") // Remove whitespace around delimiters
    .replace(/;\}/g, "}") // Remove trailing semicolons
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

async function minifyFile(filePath) {
  const ext = path.extname(filePath);
  const content = fs.readFileSync(filePath, "utf-8");

  if (ext === ".js" || ext === ".mjs") {
    const result = await esbuild.transform(content, {
      minify: true,
      target: "es2017",
      format: "cjs",
    });
    fs.writeFileSync(filePath, result.code, "utf-8");
  } else if (ext === ".wxss" || ext === ".css") {
    const minified = minifyWxss(content);
    fs.writeFileSync(filePath, minified, "utf-8");
  } else if (ext === ".json") {
    try {
      const parsed = JSON.parse(content);
      fs.writeFileSync(filePath, JSON.stringify(parsed), "utf-8");
    } catch (e) {}
  }
}

async function minifyDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await minifyDir(fullPath);
    } else if (entry.isFile()) {
      if (fullPath.includes("/cli/") || fullPath.endsWith(".d.ts")) continue;
      await minifyFile(fullPath);
    }
  }
}

async function run() {
  const targetDir = process.argv[2];
  if (!targetDir) {
    console.error("Usage: node scripts/minify.js <directory>");
    process.exit(1);
  }
  const fullDir = path.resolve(targetDir);
  await minifyDir(fullDir);
  console.log(`[minify] ✅ Safely minified distribution in ${path.basename(fullDir)}`);
}

run().catch((err) => {
  console.error("[minify] ❌ Error:", err);
  process.exit(1);
});
