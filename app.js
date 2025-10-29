const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");

const app = express();
app.set("trust proxy", 1);

function parseOrigins(val) {
  if (!val) return [];
  return val.split(",").map(s => s.trim()).filter(Boolean);
}
const allowedOrigins = parseOrigins(process.env.FRONTEND_ORIGIN);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0 && process.env.NODE_ENV === "development") return cb(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return cb(null, true);
    return cb(new Error("CORS blocked for origin: " + origin));
  },
  credentials: true
}));

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

const { loadOpenApiRaw, openapiToPostman } = require('./utils/postman');

// Serve generated Postman collection (always up to date with openapi.yml)
app.get('/api/postman_collection.json', async (req, res) => {
  try {
    const text = loadOpenApiRaw();
    const collection = await openapiToPostman(text);
    // Optional tweak: name the collection clearly
    collection.info = collection.info || {};
    collection.info.name = 'Microcourse Auth (from OpenAPI)';
    res.json(collection);
  } catch (e) {
    res.status(500).json({ success:false, code:'SERVER_ERROR', message:e.message });
  }
});

const swaggerUi = require('swagger-ui-express');
const { loadOpenApi } = require('./utils/swagger');
const openapi = loadOpenApi();
const openapi = loadOpenApi();
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

const swaggerUiOptions = {
  customSiteTitle: 'Microcourse Auth API Docs',
  swaggerOptions: {
    docExpansion: 'list',
    persistAuthorization: true,        // keeps your Bearer token set
    tryItOutEnabled: true
  }
};

app.use("/api", apiLimiter);

app.get('/api/openapi.json', (req, res) => res.json(openapi));

app.get("/healthz", (req, res) => res.status(200).json({ ok: true, service: "microcourse-backend", ts: Date.now() }));
app.get("/api/health", (req, res) => res.status(200).json({ ok: true, scope: "api", ts: Date.now() }));

app.use("/api/auth", authRoutes);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, swaggerUiOptions));

app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "Not found: " + req.method + " " + req.originalUrl });
});

app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const code = status >= 500 ? "SERVER_ERROR" : "REQUEST_ERROR";
  if (process.env.NODE_ENV !== "production") console.error("[Error]", status, err.message);
  res.status(status).json({ success: false, code, message: err.message || "Unexpected error" });
});

module.exports = app;
