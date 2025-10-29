/* Build a Postman collection JSON from docs/openapi.yml to ./Microcourse_Auth_fromOpenAPI.postman_collection.json */
const fs = require('fs');
const path = require('path');
const { loadOpenApiRaw, openapiToPostman } = require('../utils/postman');

(async () => {
  try {
    const text = loadOpenApiRaw();
    const collection = await openapiToPostman(text);
    collection.info = collection.info || {};
    collection.info.name = 'Microcourse Auth (from OpenAPI)';
    const out = path.join(process.cwd(), 'Microcourse_Auth_fromOpenAPI.postman_collection.json');
    fs.writeFileSync(out, JSON.stringify(collection, null, 2));
    console.log('✅ Wrote:', out);
  } catch (e) {
    console.error('❌ Build failed:', e.message);
    process.exit(1);
  }
})();
