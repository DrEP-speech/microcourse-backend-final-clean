const path = require('path');
const fs = require('fs');
const YAML = require('yaml');

function loadOpenApi() {
  const specPath = path.join(__dirname, '..', 'docs', 'openapi.yml');
  const text = fs.readFileSync(specPath, 'utf8');
  return YAML.parse(text);
}

module.exports = { loadOpenApi };
