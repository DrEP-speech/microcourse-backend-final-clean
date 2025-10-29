const path = require('path');
const fs = require('fs');
const YAML = require('yaml');
const converter = require('openapi-to-postmanv2');


function loadOpenApiRaw() {
  const specPath = path.join(__dirname, '..', 'docs', 'openapi.yml');
  return fs.readFileSync(specPath, 'utf8');
}

function openapiToPostman(openapiText) {
  return new Promise((resolve, reject) => {
    converter.convert(
      {
        type: 'string',
        data: openapiText
      },
      {
        // nice defaults
        folderStrategy: 'Tags',
        requestParametersResolution: 'Example',
        exampleParametersResolution: 'Example',
        schemaFaker: true,
        optimizeConversion: true
      },
      (err, result) => {
        if (err) return reject(err);
        if (!result?.result) return reject(new Error('Conversion failed'));
        resolve(result.output[0].data); // Postman collection JSON
      }
    );
  });
}

{
  "scripts": {
    "openapi:validate": "swagger-cli validate ./docs/openapi.yml",
    "postman:build": "openapi2postmanv2 -s ./docs/openapi.yml -o ./Microcourse_Auth_fromOpenAPI.postman_collection.json -p -O folderStrategy=Tags,requestParametersResolution=Example,exampleParametersResolution=Example,schemaFaker=true"
  }
}


module.exports = { loadOpenApiRaw, openapiToPostman };
