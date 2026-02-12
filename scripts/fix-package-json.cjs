const fs = require("fs");

const path = "package.json";
const raw = fs.readFileSync(path, "utf8");

// If package.json already broken, attempt a minimal salvage by trimming after last }.
let text = raw;
const lastBrace = raw.lastIndexOf("}");
if (lastBrace !== -1) text = raw.slice(0, lastBrace + 1);

let pkg;
try {
  pkg = JSON.parse(text);
} catch (e) {
  console.error("package.json is not valid JSON. Please restore a valid package.json (or paste it) then rerun.");
  console.error(e.message);
  process.exit(1);
}

pkg.scripts = pkg.scripts || {};
pkg.scripts.start = pkg.scripts.start || "node server.js";
pkg.scripts.dev = pkg.scripts.dev || "node server.js";
pkg.scripts.doctor = "pwsh -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\doctor.ps1";
pkg.scripts["doctor:prod"] = "pwsh -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\doctor.prod.ps1 -BaseUrl %BASE_URL%";

fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log("OK: package.json scripts normalized");