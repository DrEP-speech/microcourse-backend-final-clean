Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBomFile([string]$Path, [string]$Content) {
  $dir = Split-Path $Path -Parent
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

Write-Utf8NoBomFile "server.js" @"
"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connectDB, mongoose } = require("./db");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/healthz", (req, res) => res.status(200).send("ok"));

app.get("/readyz", (req, res) => {
  const readyState = mongoose.connection?.readyState ?? -1;
  const connected = readyState === 1;
  res.status(connected ? 200 : 503).json({
    ok: true,
    ready: connected,
    name: "microcourse-backend",
    env: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "unknown",
    time: new Date().toISOString(),
    db: { readyState, connected },
  });
});

function safeMount(path, modulePath) {
  try {
    const router = require(modulePath);
    app.use(path, router);
    console.log(`[route] mounted ${path} -> ${modulePath}`);
  } catch (e) {
    console.warn(`[route] skip ${path} (${modulePath}): ${e.message}`);
  }
}

safeMount("/api/auth", "./routes/authRoutes");
safeMount("/api/courses", "./routes/courseRoutes");
safeMount("/api/quizzes", "./routes/quizRoutes");
safeMount("/api/analytics", "./routes/analyticsRoutes");

safeMount("/api/notifications", "./routes/notificationRoutes");
safeMount("/api/email", "./routes/emailRoutes");
safeMount("/api/audit", "./routes/auditRoutes");
safeMount("/", "./routes/healthRoutes");

app.use((req, res) => res.status(404).json({ ok: false, error: "API route not found" }));

const PORT = Number(process.env.PORT || 4000);

async function boot() {
  await connectDB();
  app.listen(PORT, "0.0.0.0", () => console.log(`API listening on http://localhost:${PORT}`));
}

boot().catch((err) => {
  console.error("BOOT_FAILED:", err?.message || err);
  process.exit(1);
});
"@

Write-Host "✔ server.js rewritten (canonical)" -ForegroundColor Green