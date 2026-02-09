/**
 * scripts/contract/validate-contract.js
 * Loads all *Routes.js files to catch missing imports/controllers at require-time.
 */
const fs = require("fs");
const path = require("path");

const routesDir = path.join(__dirname, "../../routes");
let failures = 0;

for (const file of fs.readdirSync(routesDir)) {
  if (!file.endsWith("Routes.js")) continue;
  const p = path.join(routesDir, file);
  try {
    require(p);
    console.log(`✔ ${file} loaded`);
  } catch (e) {
    failures++;
    console.error(`✖ ${file} failed`);
    console.error(`  ${e.message}`);
  }
}

if (failures) {
  console.error(`\n❌ Contract validation failed: ${failures}`);
  process.exit(1);
}

console.log("\n✅ Contract validation passed");
