import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

function loadJson(path) {
  const fs = await import("node:fs/promises");
  const raw = await fs.readFile(path, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const [,, schemaPath, dataPath] = process.argv;

  if (!schemaPath || !dataPath) {
    console.error("Usage: node scripts/contract/validate-contract.mjs <schema.json> <data.json>");
    process.exit(2);
  }

  const schema = await loadJson(schemaPath);
  const data = await loadJson(dataPath);

  const validate = ajv.compile(schema);
  const ok = validate(data);

  if (!ok) {
    console.error("❌ Schema validation failed");
    console.error(validate.errors);
    process.exit(1);
  }

  console.log("✅ Schema validation passed");
}

main().catch((e) => {
  console.error("Validator error:", e);
  process.exit(1);
});