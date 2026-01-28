/* eslint-disable no-console */
const { spawnSync } = require("child_process");

function run(script) {
  const r = spawnSync(process.execPath, [script], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status);
}

run(require("path").join(__dirname, "seed-owner.js"));
run(require("path").join(__dirname, "seed-demo.js"));

console.log("✅ All seeds complete.");
