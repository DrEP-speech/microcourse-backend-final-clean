import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";

async function readJson(p) {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const root = process.cwd();
  const artifactsDir = path.join(root, "scripts", "contract", "artifacts");
  const schemasDir   = path.join(root, "scripts", "contract", "schemas");

  const args = process.argv.slice(2);
  const artifacts = args.length ? args : ["healthz.json", "readyz.json"];

  const ajv = new Ajv({ allErrors: true, strict: false });

  // Load all schemas in scripts/contract/schemas (if any)
  try {
    const schemaFiles = await fs.readdir(schemasDir);
    for (const f of schemaFiles) {
      if (f.endsWith(".json")) {
        const schemaPath = path.join(schemasDir, f);
        const schema = await readJson(schemaPath);
        ajv.addSchema(schema, schema.$id || f);
      }
    }
  } catch {
    // schemas folder may be empty; that's fine
  }

  let failed = 0;

  for (const file of artifacts) {
    const artifactPath = path.join(artifactsDir, file);
    const schemaPath   = path.join(schemasDir, file); // convention: schema filename matches artifact filename

    const artifact = await readJson(artifactPath);

    // If a matching schema exists, validate; otherwise just enforce "must be object"
    let validate;
    try {
      const schema = await readJson(schemaPath);
      validate = ajv.compile(schema);
    } catch {
      validate = ajv.compile({ type: "object" });
    }

    const ok = validate(artifact);
    if (!ok) {
      failed++;
      console.error(`❌ Contract failed for ${file}`);
      console.error(validate.errors);
    } else {
      console.log(`✅ Contract OK for ${file}`);
    }
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Validator crashed:", err);
  process.exit(1);
});
