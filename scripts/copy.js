const fs = require("fs");
const path = require("path");

function copy(src, dest) {
  const resolved = path.resolve(src);

  if (!fs.existsSync(resolved)) {
    console.error(`[copy] ❌ Source not found: ${src}`);
    process.exit(1);
  }

  const destDir = fs.statSync(resolved).isDirectory() ? path.dirname(dest) : path.dirname(dest);

  if (destDir) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (fs.statSync(resolved).isDirectory()) {
    fs.cpSync(resolved, path.resolve(dest), { recursive: true });
  } else {
    fs.copyFileSync(resolved, path.resolve(dest));
  }

  console.log(`[copy] ✅ ${src} → ${dest}`);
}

function run() {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.length % 2 !== 0) {
    console.error("Usage: node scripts/copy.js <src> <dest> [<src> <dest> ...]");
    process.exit(1);
  }

  for (let i = 0; i < args.length; i += 2) {
    copy(args[i], args[i + 1]);
  }
}

run();
