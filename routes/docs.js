"use strict";
const path = require("path");
const fs = require("fs");
const express = require("express");
const router = express.Router();
const yaml = require("js-yaml");
const swaggerUi = require("swagger-ui-express");
const redoc = require("redoc-express");

const SPEC_PATH = path.resolve(__dirname, "../../docs/openapi.yaml");
const spec = yaml.load(fs.readFileSync(SPEC_PATH, "utf8"));

router.get("/openapi.json", (_req, res) => res.json(spec));

router.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(spec, {
    explorer: true,
    customSiteTitle: "MicroCourse API – Swagger",
    customCssUrl: "/api/docs/_dark.css"
  })
);

router.get("/_dark.css", (_req,res)=> res.sendFile(path.resolve(__dirname, "../../docs/swagger-dark.css")));

router.get("/../redoc", redoc({
  title: "MicroCourse API – ReDoc",
  specUrl: "/api/docs/openapi.json"
}));

// Static ReDoc (built file)
router.get("/../redoc-static", (_req,res) => {
  const file = path.resolve(__dirname, "../../public/api-docs.html");
  if (fs.existsSync(file)) return res.sendFile(file);
  return res.status(404).send("Build docs first: npm run docs:build");
});

module.exports = router;
