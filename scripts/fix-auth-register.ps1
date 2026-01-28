$ErrorActionPreference = "Stop"

function Write-TextFileUtf8NoBom([string]$Path, [string]$Content) {
  if ([string]::IsNullOrWhiteSpace($Path)) { throw "Write-TextFileUtf8NoBom: Path is empty." }
  $dir = Split-Path -Parent $Path
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Backup-File([string]$Path) {
  if (Test-Path $Path) {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    $bak = "$Path.bak.$ts"
    Copy-Item $Path $bak -Force
    return $bak
  }
  return $null
}

function Ensure-Dependency($pkg, [string]$name, [string]$version) {
  if (-not $pkg.dependencies) {
    $pkg | Add-Member -MemberType NoteProperty -Name dependencies -Value ([pscustomobject]@{})
  }
  $deps = $pkg.dependencies

  $has = $false
  try { $null = $deps.$name; $has = $true } catch { $has = $false }

  if (-not $has -or [string]::IsNullOrWhiteSpace($deps.$name)) {
    $deps | Add-Member -MemberType NoteProperty -Name $name -Value $version -Force
    Write-Host "Added dependency: $name@$version" -ForegroundColor Green
  } else {
    Write-Host "Dependency already present: $name@$($deps.$name)" -ForegroundColor DarkGray
  }
}

# --- Verify we're in the right place
$root = (Get-Location).Path
$pkgPath = Join-Path $root "package.json"
$serverPath = Join-Path $root "server.js"

if (!(Test-Path $pkgPath)) { throw "package.json not found in $root. CD into the backend root first." }
if (!(Test-Path $serverPath)) { Write-Host "WARN: server.js not found in $root (still continuing)..." -ForegroundColor Yellow }

# --- Patch package.json deps
$pkgRaw = Get-Content -Raw $pkgPath
$pkg = $pkgRaw | ConvertFrom-Json

Ensure-Dependency $pkg "bcryptjs" "^2.4.3"
Ensure-Dependency $pkg "jsonwebtoken" "^9.0.2"
Ensure-Dependency $pkg "cookie-parser" "^1.4.6"

$pkgJson = $pkg | ConvertTo-Json -Depth 20
Backup-File $pkgPath | Out-Null
Write-TextFileUtf8NoBom $pkgPath $pkgJson

# --- Ensure routes folder exists
$routesDir = Join-Path $root "src\routes"
if (!(Test-Path $routesDir)) { New-Item -ItemType Directory -Force -Path $routesDir | Out-Null }

# --- Write authRoutes.js (overwrite to guarantee /register exists)
$authFile = Join-Path $routesDir "authRoutes.js"
$bak = Backup-File $authFile

$authJs = @"
'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

function signToken(user) {
  const secret = process.env.JWT_SECRET || 'dev_secret';
  const payload = {
    sub: String(user._id),
    email: user.email,
    role: user.role || 'student'
  };
  return jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '2h' });
}

function getPasswordField() {
  // supports either passwordHash or password, depending on your User schema
  const paths = (User && User.schema && User.schema.paths) ? User.schema.paths : {};
  if (paths.passwordHash) return 'passwordHash';
  if (paths.password) return 'password';
  return 'passwordHash';
}

router.post('/register', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = req.body.role ? String(req.body.role) : 'student';

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'email and password required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'password must be at least 6 characters' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ ok: false, error: 'email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const passField = getPasswordField();

    const doc = { email, role };
    doc[passField] = hash;

    const user = await User.create(doc);

    const token = signToken(user);
    return res.status(201).json({
      ok: true,
      token,
      user: { id: String(user._id), email: user.email, role: user.role || role }
    });
  } catch (err) {
    console.error('[auth/register] error:', err);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'email and password required' });
    }

    // pull both fields just in case schema differs
    const user = await User.findOne({ email }).select('+passwordHash +password');
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const stored = user.passwordHash || user.password;
    const ok = await bcrypt.compare(password, String(stored || ''));
    if (!ok) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const token = signToken(user);
    return res.json({
      ok: true,
      token,
      user: { id: String(user._id), email: user.email, role: user.role || 'student' }
    });
  } catch (err) {
    console.error('[auth/login] error:', err);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ ok: false, error: 'Missing Bearer token' });

    const secret = process.env.JWT_SECRET || 'dev_secret';
    const payload = jwt.verify(token, secret);

    const user = await User.findById(payload.sub).select('email role');
    if (!user) return res.status(401).json({ ok: false, error: 'User not found' });

    return res.json({ ok: true, user: { id: String(user._id), email: user.email, role: user.role } });
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
});

module.exports = router;
"@

Write-TextFileUtf8NoBom $authFile $authJs

Write-Host "PATCH OK" -ForegroundColor Green
Write-Host "Auth routes file: $authFile" -ForegroundColor Cyan
if ($bak) { Write-Host "Backup saved: $bak" -ForegroundColor DarkGray }

Write-Host "`nInstalling deps (npm install)..." -ForegroundColor Cyan
npm install

Write-Host "`nNEXT:" -ForegroundColor Cyan
Write-Host "1) Restart backend:  (stop node), then: node .\server.js" -ForegroundColor Gray
Write-Host "2) Verify: irm http://localhost:4000/api/health" -ForegroundColor Gray
Write-Host "3) Register/Login test commands are in the chat message." -ForegroundColor Gray
