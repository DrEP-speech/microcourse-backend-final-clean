module.exports = {
  openapi: "3.0.3",
  info: { title: "MicroCourse Demo API", version: "2.0.0",
    description: "JWT auth + roles, uploads, assets, file/Mongo storage. Swagger UI at /docs." },
  servers: [{ url: "http://localhost:{port}", variables: { port: { default: "10003" } } }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
    schemas: {
      ErrorResponse:{ type:"object", properties:{ success:{type:"boolean"}, message:{type:"string"} } },
      HealthResponse:{ type:"object", properties:{ ok:{type:"boolean"}, env:{type:"string"}, storage:{type:"string"},
        uptime_seconds:{type:"integer"}, timestamp:{type:"string",format:"date-time"}, videoServiceBase:{type:"string"} } },
      User:{ type:"object", properties:{ id:{type:"string"}, email:{type:"string"}, name:{type:"string"}, role:{type:"string"}, createdAt:{type:"string"} } },
      AuthRegisterBody:{ type:"object", required:["email","password"], properties:{ email:{type:"string"}, password:{type:"string"}, name:{type:"string"}, role:{type:"string"} } },
      AuthLoginBody:{ type:"object", required:["email","password"], properties:{ email:{type:"string"}, password:{type:"string"} } },
      AuthResponse:{ type:"object", properties:{ success:{type:"boolean"}, token:{type:"string"}, user:{ $ref:"#/components/schemas/User" } } },
      Asset:{ type:"object", properties:{ id:{type:"string"}, lessonId:{type:"string"}, type:{type:"string"}, url:{type:"string"}, title:{type:"string"}, createdAt:{type:"string"} } },
      AssetsListResponse:{ type:"object", properties:{ success:{type:"boolean"}, lessonId:{type:"string"},
        items:{ type:"array", items:{ $ref:"#/components/schemas/Asset" } }, total:{type:"integer"}, page:{type:"integer"}, limit:{type:"integer"} } },
      CreateAssetBody:{ type:"object", required:["type","url"], properties:{ type:{type:"string"}, url:{type:"string"}, title:{type:"string"} } },
      CreateAssetResponse:{ type:"object", properties:{ success:{type:"boolean"}, item:{ $ref:"#/components/schemas/Asset" } } },
      UpdateAssetBody:{ type:"object", properties:{ title:{type:"string"}, type:{type:"string"}, url:{type:"string"} } },
      DeleteResponse:{ type:"object", properties:{ success:{type:"boolean"}, deletedId:{type:"string"} } },
      ClearResponse:{ type:"object", properties:{ success:{type:"boolean"}, cleared:{type:"boolean"} } },
      UploadedFile:{ type:"object", properties:{ originalName:{type:"string"}, mimeType:{type:"string"}, size:{type:"integer"}, filename:{type:"string"}, url:{type:"string"} } },
      UploadResponse:{ type:"object", properties:{ success:{type:"boolean"}, file:{ $ref:"#/components/schemas/UploadedFile" }, asset:{ $ref:"#/components/schemas/Asset" } } }
    }
  },
  paths: {
    "/health": { get: { summary:"Health", responses:{ "200":{ description:"OK", content:{ "application/json":{ schema:{ $ref:"#/components/schemas/HealthResponse" } } } } } } },
    "/api/openapi.json": { get: { summary:"OpenAPI spec", responses:{ "200":{ description:"OK" } } } },

    "/api/auth/register": {
      post: {
        summary:"Register a user",
        requestBody:{ required:true, content:{ "application/json":{ schema:{ $ref:"#/components/schemas/AuthRegisterBody" } } } },
        responses:{ "201":{ description:"Created", content:{ "application/json":{ schema:{ $ref:"#/components/schemas/AuthResponse" } } } },
                    "403":{ description:"Forbidden", content:{ "application/json":{ schema:{ $ref:"#/components/schemas/ErrorResponse" } } } } }
      }
    },
    "/api/auth/login": {
      post: {
        summary:"Login",
        requestBody:{ required:true, content:{ "application/json":{ schema:{ $ref:"#/components/schemas/AuthLoginBody" } } } },
        responses:{ "200":{ description:"OK", content:{ "application/json":{ schema:{ $ref:"#/components/schemas/AuthResponse" } } } },
                    "401":{ description:"Unauthorized" } }
      }
    },
    "/api/me": {
      get: {
        summary:"Current user",
        security:[{ bearerAuth: [] }],
        responses:{ "200":{ description:"OK", content:{ "application/json":{ schema:{ $ref:"#/components/schemas/User" } } } } }
      }
    },

    "/api/uploads": {
      post: {
        summary:"Upload a file (multipart). Optionally create an Asset.",
        security:[{ bearerAuth: [] }],
        parameters:[
          { name:"create", in:"query", schema:{ type:"boolean" } },
          { name:"type", in:"query", schema:{ type:"string" } },
          { name:"title", in:"query", schema:{ type:"string" } }
        ],
        requestBody:{ required:true, content:{ "multipart/form-data":{ schema:{ type:"object", properties:{ file:{ type:"string", format:"binary" } }, required:["file"] } } } },
        responses:{ "201":{ description:"Uploaded", content:{ "application/json":{ schema:{ $ref:"#/components/schemas/UploadResponse" } } } } }
      }
    },

    "/api/lessons/demo/assets": {
      get: {
        summary:"List assets",
        parameters:[ {name:"type",in:"query",schema:{type:"string"}},{name:"page",in:"query",schema:{type:"integer"}},{name:"limit",in:"query",schema:{type:"integer"}} ],
        responses:{ "200":{ description:"OK", content:{ "application/json":{ schema:{ $ref:"#/components/schemas/AssetsListResponse" } } } } }
      },
      post: {
        summary:"Create asset (URL-based)",
        security:[{ bearerAuth: [] }],
        requestBody:{ required:true, content:{ "application/json":{ schema:{ $ref:"#/components/schemas/CreateAssetBody" } } } },
        responses:{ "201":{ description:"Created", content:{ "application/json":{ schema:{ $ref:"#/components/schemas/CreateAssetResponse" } } } },
                    "400":{ description:"Bad Request" } }
      },
      delete: {
        summary:"Clear all assets",
        security:[{ bearerAuth: [] }],
        responses:{ "200":{ description:"Cleared", content:{ "application/json":{ schema:{ $ref:"#/components/schemas/ClearResponse" } } } } }
      }
    },
    "/api/lessons/demo/assets/{id}": {
      put: {
        summary:"Update asset",
        security:[{ bearerAuth: [] }],
        parameters:[{ name:"id", in:"path", required:true, schema:{ type:"string" } }],
        requestBody:{ required:true, content:{ "application/json":{ schema:{ $ref:"#/components/schemas/UpdateAssetBody" } } } },
        responses:{ "200":{ description:"Updated", content:{ "application/json":{ schema:{ $ref:"#/components/schemas/CreateAssetResponse" } } } },
                    "404":{ description:"Not found" } }
      },
      delete: {
        summary:"Delete asset",
        security:[{ bearerAuth: [] }],
        parameters:[{ name:"id", in:"path", required:true, schema:{ type:"string" } }],
        responses:{ "200":{ description:"Deleted", content:{ "application/json":{ schema:{ $ref:"#/components/schemas/DeleteResponse" } } } },
                    "404":{ description:"Not found" } }
      }
    },
    "/api/lessons/demo": {
      get: { summary:"Lesson summary", responses:{ "200":{ description:"OK" } } }
    }
  }
};
