$ErrorActionPreference = "Stop"

function Write-TextFile {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  $dir = Split-Path -Parent $Path
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Set-Content -LiteralPath $Path -Value $Content -Encoding utf8NoBOM
}

# Root resolution that works even if $PSScriptRoot is empty (interactive execution)
$root = if ($PSScriptRoot -and $PSScriptRoot.Trim().Length -gt 0) {
  (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
  (Get-Location).Path
}

$serverPath = Join-Path $root "server.js"
$autoMountPath = Join-Path $root "routes\autoMountRoutes.js"
$jwtPath = Join-Path $root "utils\jwt.js"
$authPath = Join-Path $root "middleware\auth.js"
$requireAuthPath = Join-Path $root "middleware\requireAuth.js"
$rolesPath = Join-Path $root "middleware\roles.js"

# --- routes/autoMountRoutes.js (CommonJS; never crashes boot on broken routes) ---
$autoMount = @"
const fs = require('fs');
const path = require('path');

function toRouteSegment(fileBase) {
  let name = String(fileBase || '')
    .replace(/\.js$/i, '')
    .replace(/Routes$/i, '')
    .trim();

  const lower = name.toLowerCase();

  // Friendly defaults for common route names
  const map = {
    course: 'courses',
    courses: 'courses',
    quiz: 'quizzes',
    quizzes: 'quizzes',
    user: 'users',
    users: 'users',
    auth: 'auth',
    admin: 'admin',
    email: 'email',
    notifications: 'notifications',
    notification: 'notifications',
    insights: 'insights',
    analytics: 'analytics',
    dashboard: 'dashboard',
    pdf: 'pdf',
    webhook: 'webhooks',
    webhooks: 'webhooks',
    lesson: 'lessons',
    lessons: 'lessons',
    student: 'student',
    instructor: 'instructor',
    dbcheck: 'dbcheck',
    merged: 'merged',
    debug: 'debug'
  };

  return map[lower] || lower;
}

function isExpressRouter(obj) {
  return obj && typeof obj === 'function' && typeof obj.use === 'function' && typeof obj.get === 'function';
}

function normalizeExport(mod) {
  // Supports: module.exports = router
  // Also tolerates: exports.default = router / { default: router }
  if (!mod) return null;
  if (isExpressRouter(mod)) return mod;
  if (isExpressRouter(mod.default)) return mod.default;
  if (isExpressRouter(mod.router)) return mod.router;
  return null;
}

function autoMountRoutes(app, opts = {}) {
  const routesDir = opts.routesDir || path.join(process.cwd(), 'routes');
  const basePrefix = (opts.basePrefix || '/api').replace(/\/+$/,'');
  const verbose = opts.verbose !== false;

  if (!fs.existsSync(routesDir)) {
    if (verbose) console.warn('[autoMountRoutes] routes dir not found:', routesDir);
    return { mounted: [], skipped: [] };
  }

  const ignore = new Set([
    'autoMountRoutes.js',
    'index.js'
  ]);

  const mounted = [];
  const skipped = [];

  const files = fs.readdirSync(routesDir)
    .filter(f => f.toLowerCase().endsWith('.js'))
    .filter(f => !ignore.has(f))
    .filter(f => !f.toLowerCase().includes('.bak'))
    .filter(f => !f.toLowerCase().includes('.backup'))
    .filter(f => !f.toLowerCase().includes('.broken'));

  for (const file of files) {
    const abs = path.join(routesDir, file);
    const base = path.basename(file, '.js');
    const seg = toRouteSegment(base);
    const mountPath = basePrefix + '/' + seg;

    try {
      const mod = require(abs);
      const router = normalizeExport(mod);

      if (!router) {
        skipped.push({ file, reason: 'no-router-export' });
        if (verbose) console.warn('[autoMountRoutes] SKIP (no router export):', file);
        continue;
      }

      app.use(mountPath, router);
      mounted.push({ file, mountPath });
      if (verbose) console.log('[autoMountRoutes] MOUNT', mountPath, '-> routes/' + file);
    } catch (e) {
      skipped.push({ file, reason: 'require-failed', error: String(e && e.message ? e.message : e) });
      if (verbose) console.warn('[autoMountRoutes] FAIL (require):', file, '-', String(e && e.message ? e.message : e));
    }
  }

  return { mounted, skipped };
}

module.exports = { autoMountRoutes };
"@

# --- utils/jwt.js (fixes your Invalid/unexpected token corruption) ---
$jwt = @"
const jwt = require('jsonwebtoken');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev_secret_change_me';
}

function signToken(payload, opts = {}) {
  const expiresIn = opts.expiresIn || process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = { signToken, verifyToken };
"@

# --- middleware/requireAuth.js ---
$requireAuth = @"
const { verifyToken } = require('../utils/jwt');

function extractBearer(req) {
  const h = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!h) return null;
  const s = String(h);
  if (!s.toLowerCase().startsWith('bearer ')) return null;
  return s.slice(7).trim();
}

function requireAuth(req, res, next) {
  try {
    const bearer = extractBearer(req);
    const cookieToken = req.cookies && (req.cookies.token || req.cookies.accessToken || req.cookies.authToken);
    const token = bearer || cookieToken;

    if (!token) return res.status(401).json({ ok: false, message: 'Unauthorized' });

    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ ok: false, message: 'Unauthorized', error: String(e && e.message ? e.message : e) });
  }
}

module.exports = { requireAuth };
"@

# --- middleware/roles.js ---
$roles = @"
function requireRole(...roles) {
  const allow = roles.map(r => String(r).toLowerCase());
  return (req, res, next) => {
    const role = req.user && req.user.role ? String(req.user.role).toLowerCase() : '';
    if (!role || !allow.includes(role)) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { requireRole };
"@

# --- middleware/auth.js (compat: exports authBearer + requireAuth + requireRole) ---
$auth = @"
const { requireAuth } = require('./requireAuth');
const { requireRole } = require('./roles');

function authBearer(req, res, next) {
  return requireAuth(req, res, next);
}

module.exports = { requireAuth, requireRole, authBearer };
"@

# --- server.js (CommonJS; safe route mounting; Mongo optional) ---
$server = @"
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

let mongoose = null;
try { mongoose = require('mongoose'); } catch (_) {}

const { autoMountRoutes } = require('./routes/autoMountRoutes');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(morgan(process.env.MORGAN_FORMAT || 'dev'));

const corsOrigin = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: function(origin, cb) {
    // allow non-browser tools (Postman/curl) with no origin
    if (!origin) return cb(null, true);
    if (corsOrigin.includes('*')) return cb(null, true);
    return cb(null, corsOrigin.includes(origin));
  },
  credentials: true
}));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    name: process.env.APP_NAME || 'microcourse-api',
    uptime: process.uptime(),
    ts: new Date().toISOString()
  });
});

// Auto-mount /routes/*.js under /api/<name>
autoMountRoutes(app, {
  basePrefix: process.env.ROUTES_PREFIX || '/api',
  verbose: true
});

app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Not Found', path: req.path });
});

app.use((err, req, res, next) => {
  console.error('[server] error:', err);
  res.status(500).json({
    ok: false,
    message: 'Server Error',
    error: process.env.NODE_ENV === 'production'
      ? 'redacted'
      : String(err && err.message ? err.message : err)
  });
});

function looksLikePlaceholder(uri) {
  const s = String(uri || '');
  return s.includes('your_mongo') || s.includes('YOUR_MONGO') || s.includes('<') || s.includes('REPLACE_ME');
}

async function start() {
  const port = Number(process.env.PORT || 11001);

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (mongoose && mongoUri && !looksLikePlaceholder(mongoUri) &&
      (mongoUri.startsWith('mongodb://') || mongoUri.startsWith('mongodb+srv://'))) {
    try {
      await mongoose.connect(mongoUri);
      console.log('[server] Mongo connected');
    } catch (e) {
      console.warn('[server] Mongo connect failed - continuing without DB:', String(e && e.message ? e.message : e));
    }
  } else {
    console.warn('[server] Mongo disabled (missing/placeholder/invalid URI)');
  }

  app.listen(port, () => {
    console.log('[server] API running on http://localhost:' + port);
  });
}

start();
"@

# Write files
Write-TextFile -Path $autoMountPath -Content $autoMount
Write-TextFile -Path $jwtPath -Content $jwt
Write-TextFile -Path $requireAuthPath -Content $requireAuth
Write-TextFile -Path $rolesPath -Content $roles
Write-TextFile -Path $authPath -Content $auth
Write-TextFile -Path $serverPath -Content $server

# Ensure package.json scripts/dev deps (and remove accidental "type":"module" if present)
$pkgPath = Join-Path $root "package.json"
if (Test-Path $pkgPath) {
  $raw = Get-Content -LiteralPath $pkgPath -Raw
  $json = $raw | ConvertFrom-Json

  if ($json.PSObject.Properties.Name -contains "type" -and $json.type -eq "module") {
    $json.PSObject.Properties.Remove("type") | Out-Null
  }

  if (-not $json.scripts) { $json | Add-Member -NotePropertyName scripts -NotePropertyValue ([pscustomobject]@{}) }
  if (-not $json.scripts.dev) { $json.scripts | Add-Member -NotePropertyName dev -NotePropertyValue "nodemon --config nodemon.json server.js" }

  $json | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $pkgPath -Encoding utf8NoBOM
}

# Install required deps (safe to re-run)
$deps = @("express","cors","helmet","cookie-parser","morgan","dotenv","jsonwebtoken","mongoose")
$devDeps = @("nodemon")

Write-Host "`n[backend-fix] Installing deps (if needed)..." -ForegroundColor Cyan
npm install --silent | Out-Null
npm install --save @deps
npm install --save-dev @devDeps

Write-Host "`n[backend-fix] DONE. Now run: npm run dev" -ForegroundColor Green
