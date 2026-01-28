/* eslint-disable no-console */
const fs = require("fs");

function checkFile(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing required file: ${p}`);
}

function main() {
  // A "build" for this backend means: validate critical files exist.
  // (If you later add TypeScript, replace this with tsc compilation.)
  checkFile("server.js");
  checkFile("src/routes/index.js");
  checkFile("src/config/env.js");
  console.log("✅ Build OK (backend scaffold verified).");
}

main();
