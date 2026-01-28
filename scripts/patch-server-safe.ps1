Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function WriteUtf8NoBom([string]$path, [string]$text) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
}

# Resolve project root (works whether you run from root or from /scripts)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootGuess = Split-Path -Parent $scriptDir
$root = $rootGuess

if (-not (Test-Path (Join-Path $root "server.js"))) {
  $root = (Get-Location).Path
}

$server = Join-Path $root "server.js"
if (-not (Test-Path $server)) {
  throw "server.js not found. Current root: $root"
}

# Backup
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$server.bak.$ts"
Copy-Item -LiteralPath $server -Destination $backup -Force

# Build a clean server.js (NO weird unicode, NO backslash paths)
$lines = @(
'"use strict";',
'',
'require("dotenv").config();',
'',
'const express = require("express");',
'const cors = require("cors");',
'const cookieParser = require("cookie-parser");',
'const helmet = require("helmet");',
'const morgan = require("morgan");',
'const mongoose = require("mongoose");',
'const fs = require("fs");',
'const path = require("path");',
'',
'const app = express();',
'',
'// Core middleware',
'app.use(helmet());',
'app.use(express.json({ limit: "2mb" }));',
'app.use(express.urlencoded({ extended: true }));',
'app.use(cookieParser());',
'',
'// CORS (supports cookie auth via credentials:true)',
'const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")',
'  .split(",")',
'  .map(s => s.trim())',
'  .filter(Boolean);',
'',
'app.use(cors({',
'  origin: function(origin, cb) {',
'    // Allow non-browser tools (Postman/curl)',
'    if (!origin) return cb(null, true);',
'    if (allowedOrigins.includes(origin)) return cb(null, true);',
'    return cb(new Error("CORS blocked: " + origin));',
'  },',
'  credentials: true',
'}));',
'',
'app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));',
'',
'// Health',
'app.get("/api/health", (req, res) => {',
'  res.json({ ok: true, service: "microcourse-backend", ts: new Date().toISOString() });',
'});',
'',
'function pickExistingFile(candidates) {',
'  for (const p of candidates) {',
'    try { if (fs.existsSync(p)) return p; } catch (e) {}',
'  }',
'  return null;',
'}',
'',
'function pickRoutesDir() {',
'  // Prefer src/routes, fallback routes',
'  return pickExistingFile([',
'    path.join(__dirname, "src", "routes"),',
'    path.join(__dirname, "routes"),',
'  ]);',
'}',
'',
'function mountIfPresent(prefix, fileBaseNames) {',
'  const routesDir = pickRoutesDir();',
'  if (!routesDir) {',
'    console.warn("[server] No routes directory found (src/routes or routes).");',
'    return false;',
'  }',
'',
'  for (const name of fileBaseNames) {',
'    const full = path.join(routesDir, name + ".js");',
'    if (!fs.existsSync(full)) continue;',
'    try {',
'      let router = require(full);',
'      if (router && router.default) router = router.default;',
'      if (typeof router !== "function") {',
'        console.warn("[server] Route file did not export a router:", full);',
'        return false;',
'      }',
'      app.use(prefix, router);',
'      console.log("[server] Mounted", prefix, "->", full);',
'      return true;',
'    } catch (e) {',
'      console.warn("[server] Failed mounting", prefix, "from", full, ":", (e && e.message) ? e.message : e);',
'      return false;',
'    }',
'  }',
'',
'  console.warn("[server] No route file found for", prefix, "in", routesDir, "candidates:", fileBaseNames.join(", "));',
'  return false;',
'}',
'',
'// Route mounts (supports common naming variants)',
'mountIfPresent("/api/auth",    ["authRoutes", "auth"]);',
'mountIfPresent("/api/courses", ["courseRoutes", "coursesRoutes", "course"]);',
'mountIfPresent("/api/quizzes", ["quizRoutes", "quizzesRoutes", "quiz"]);',
'mountIfPresent("/api/results", ["resultsRoutes", "resultRoutes", "results"]);',
'mountIfPresent("/api/insights",["insightsRoutes", "insightRoutes", "insights"]);',
'',
'// 404',
'app.use((req, res) => {',
'  res.status(404).json({ ok: false, message: "Not Found", path: req.path });',
'});',
'',
'// Error handler',
'app.use((err, req, res, next) => {',
'  console.error("[server] error:", err);',
'  res.status(500).json({',
'    ok: false,',
'    message: "Server Error",',
'    error: process.env.NODE_ENV === "production" ? "redacted" : String(err && (err.stack || err.message || err))',
'  });',
'});',
'',
'async function connectMongo() {',
'  // 1) Try project connectDB module if present',
'  const connectCandidates = [',
'    path.join(__dirname, "src", "utils", "connectDB.js"),',
'    path.join(__dirname, "src", "config", "connectDB.js"),',
'    path.join(__dirname, "src", "config", "db.js"),',
'    path.join(__dirname, "utils", "connectDB.js"),',
'  ];',
'  const connectPath = pickExistingFile(connectCandidates);',
'  if (connectPath) {',
'    try {',
'      const mod = require(connectPath);',
'      const fn = (mod && (mod.connectDB || mod.default)) || mod;',
'      if (typeof fn === "function") {',
'        await fn();',
'        console.log("[server] Mongo connected via", connectPath);',
'        return;',
'      }',
'      console.warn("[server] connectDB module found but no callable export:", connectPath);',
'    } catch (e) {',
'      console.warn("[server] connectDB module failed, falling back to mongoose.connect:", (e && e.message) ? e.message : e);',
'    }',
'  }',
'',
'  // 2) Direct mongoose.connect fallback',
'  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;',
'  if (!uri) throw new Error("Missing MONGO_URI / MONGODB_URI");',
'  await mongoose.connect(uri);',
'  console.log("[server] Mongo connected via mongoose.connect");',
'}',
'',
'const PORT = Number(process.env.PORT || 4000);',
'',
'connectMongo()',
'  .then(() => {',
'    app.listen(PORT, "0.0.0.0", () => {',
'      console.log("[server] listening on http://localhost:" + PORT);',
'    });',
'  })',
'  .catch((e) => {',
'    console.error("[server] fatal startup:", e && (e.stack || e.message || e));',
'    process.exit(1);',
'  });',
'',
'process.on("unhandledRejection", (reason) => {',
'  console.error("[server] unhandledRejection:", reason);',
'});',
'',
'process.on("uncaughtException", (err) => {',
'  console.error("[server] uncaughtException:", err);',
'});',
''
)

$serverJs = ($lines -join "`n")

# Write server.js
WriteUtf8NoBom $server $serverJs

# Syntax check (and rollback if bad)
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
  & node --check $server
  if ($LASTEXITCODE -ne 0) {
    Copy-Item -LiteralPath $backup -Destination $server -Force
    throw "Node syntax check failed. Rolled back to: $backup"
  }
}

Write-Host ""
Write-Host "PATCH OK" -ForegroundColor Green
Write-Host "Backup saved as: $backup" -ForegroundColor DarkGray
Write-Host ""
Write-Host "NEXT:" -ForegroundColor Cyan
Write-Host "  1) Start backend:   node .\server.js" -ForegroundColor Gray
Write-Host "  2) Health check:    irm http://localhost:4000/api/health" -ForegroundColor Gray
Write-Host "  3) Port check:      Get-NetTCPConnection -LocalPort 4000 -State Listen" -ForegroundColor Gray