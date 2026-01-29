const fs = require("fs");
const path = require("path");

const pkgPath = path.resolve(process.cwd(), "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

pkg.scripts = pkg.scripts || {};
pkg.scripts.dev = "node server.js";
pkg.scripts.start = "node server.js";
pkg.scripts.smoke = "pwsh -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\smoke-test.ps1";
pkg.scripts["probe:health"] = "pwsh -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\probe-health.ps1";

// Keep predev sane
pkg.scripts.predev = "npm run smoke && npm run dev";

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log("✅ Patched package.json scripts.");
