import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYAML } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const yamlPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
const jsonPath = path.join(__dirname, '..', 'docs', 'openapi.json');

const spec = parseYAML(fs.readFileSync(yamlPath, 'utf8'));
fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2));
console.log('Wrote', path.relative(process.cwd(), jsonPath));
