function Write-File {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Assert-NoMongoOperatorsInDoubleQuotedHereStrings {
  param([string]$ScriptText)
  $bad = [regex]::Matches($ScriptText, '(?s)@".*?(\$inc\s*:|\$set\s*:|\$push\s*:|\$pull\s*:|\$addToSet\s*:|\$unset\s*:).*?"@')
  if ($bad.Count -gt 0) {
    throw "Unsafe generator: Found Mongo operators inside a double-quoted here-string (@"" ""@). Use single-quoted here-string (@' '@) instead."
  }
}

# ==============================
# 02_backend_cookie_auth.ps1
# Cookie-only auth (HTTPOnly) + refresh rotation + secure CORS wiring
# Run inside BACKEND root (where package.json should live)
# ==============================

$ErrorActionPreference = "Stop"

# --- SELLABLE SAFETY: guard against "$inc:" parse errors forever ---
$rawText = Get-Content -LiteralPath $PSCommandPath -Raw
Assert-NoMongoOperatorsInDoubleQuotedHereStrings $rawText
$ROOT = (Get-Location).Path

function Ensure-Dir([string]$dir) {
  if ([string]::IsNullOrWhiteSpace($dir)) { return }
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
}

function Write-File([string]$rel, [string]$content) {
  if ([string]::IsNullOrWhiteSpace($rel)) { throw "Write-File: rel path is empty" }
  $full = Join-Path $ROOT $rel
  $parent = Split-Path $full -Parent
  Ensure-Dir $parent
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($full, $content.Replace("`r`n","`n"), $utf8NoBom)
  Write-Host "✅ wrote $rel" -ForegroundColor Green
}

# ---- folders
Ensure-Dir (Join-Path $ROOT "config")
Ensure-Dir (Join-Path $ROOT "models")
Ensure-Dir (Join-Path $ROOT "utils")
Ensure-Dir (Join-Path $ROOT "middleware")
Ensure-Dir (Join-Path $ROOT "routes")
Ensure-Dir (Join-Path $ROOT "controllers")

# ---- .env example
Write-File ".env.example" @'
NODE_ENV=development
PORT=11001
MONGO_URI=mongodb://127.0.0.1:27017/microcourse
FRONTEND_ORIGIN=http://localhost:3000
JWT_ACCESS_SECRET=dev-access-secret-change-me
JWT_REFRESH_SECRET=dev-refresh-secret-change-me
ACCESS_TTL_MIN=15 latest
REFRESH_TTL_DAYS=7
COOKIE_NAME_AT=mc_at
COOKIE_NAME_RT=mc_rt
TRUST_PROXY=0
COOKIE_SAMESITE=lax
COOKIE_SECURE=0
'@

# ---- db
Write-File "config\db.js" @'
const mongoose = require('mongoose');

async function connectDB(uri) {
  if (!uri) throw new Error('Missing MONGO_URI');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('✅ MongoDB connected');
}

module.exports = { connectDB };
'@

# ---- User model (refresh token rotation via tokenVersion)
Write-File "models\User.js" @'
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'user', enum: ['user', 'admin', 'instructor'] },

    // Refresh token rotation primitive: bump on logout or suspicious events
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

UserSchema.statics.hashPassword = async function (plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
};

module.exports = mongoose.model('User', UserSchema);
'@

# ---- JWT utils
Write-File "utils\jwt.js" @'
const jwt = require('jsonwebtoken');

function signAccessToken({ userId, role }, opts = {}) {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('Missing JWT_ACCESS_SECRET');
  const ttlMin = parseInt(process.env.ACCESS_TTL_MIN || '15', 10);
  return jwt.sign(
    { sub: userId, role },
    secret,
    { expiresIn: opts.expiresIn || \`\${ttlMin}m\` }
  );
}

function signRefreshToken({ userId, role, tokenVersion }, opts = {}) {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('Missing JWT_REFRESH_SECRET');
  const days = parseInt(process.env.REFRESH_TTL_DAYS || '7', 10);
  return jwt.sign(
    { sub: userId, role, tv: tokenVersion },
    secret,
    { expiresIn: opts.expiresIn || \`\${days}d\` }
  );
}

function verifyAccessToken(token) {
  const secret = process.env.JWT_ACCESS_SECRET;
  return jwt.verify(token, secret);
}

function verifyRefreshToken(token) {
  const secret = process.env.JWT_REFRESH_SECRET;
  return jwt.verify(token, secret);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
'@

# ---- Cookie utils (production-safe)
Write-File "utils\cookies.js" @'
function boolEnv(v, fallback = false) {
  if (typeof v === 'undefined') return fallback;
  return String(v).trim() === '1' || String(v).toLowerCase() === 'true';
}

function cookieNames() {
  return {
    at: process.env.COOKIE_NAME_AT || 'mc_at',
    rt: process.env.COOKIE_NAME_RT || 'mc_rt',
  };
}

function cookieFlags() {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // If behind reverse proxy (Render, Railway, Nginx), set TRUST_PROXY=1
  const secure = boolEnv(process.env.COOKIE_SECURE, nodeEnv === 'production');
  const sameSite = (process.env.COOKIE_SAMESITE || (nodeEnv === 'production' ? 'none' : 'lax')).toLowerCase();

  // NOTE: cross-site cookie requires: SameSite=None + Secure=true + CORS credentials
  return {
    httpOnly: true,
    secure,
    sameSite: sameSite === 'none' ? 'none' : 'lax',
    path: '/',
  };
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  const names = cookieNames();
  const flags = cookieFlags();

  // Short access cookie (browser will keep until expires)
  const accessMaxAgeMs = (parseInt(process.env.ACCESS_TTL_MIN || '15', 10) * 60 * 1000);
  const refreshMaxAgeMs = (parseInt(process.env.REFRESH_TTL_DAYS || '7', 10) * 24 * 60 * 60 * 1000);

  res.cookie(names.at, accessToken, { ...flags, maxAge: accessMaxAgeMs });
  res.cookie(names.rt, refreshToken, { ...flags, maxAge: refreshMaxAgeMs });
}

function clearAuthCookies(res) {
  const names = cookieNames();
  const flags = cookieFlags();
  res.clearCookie(names.at, { ...flags, maxAge: 0 });
  res.clearCookie(names.rt, { ...flags, maxAge: 0 });
}

module.exports = {
  cookieNames,
  cookieFlags,
  setAuthCookies,
  clearAuthCookies,
};
'@

# ---- requireAuth middleware (real backend protection)
Write-File "middleware\requireAuth.js" @'
const { verifyAccessToken } = require('../utils/jwt');
const { cookieNames } = require('../utils/cookies');

function requireAuth(req, res, next) {
  try {
    const names = cookieNames();
    const token = req.cookies?.[names.at];
    if (!token) return res.status(401).json({ message: 'Not authenticated' });

    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid/expired session' });
  }
}

function requireRole(roles = []) {
  return (req, res, next) => {
    const r = req.user?.role;
    if (!r || !roles.includes(r)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

module.exports = { requireAuth, requireRole };
'@

# ---- Auth controller (cookie-only + refresh rotation)
Write-File "controllers\authController.js" @'
const User = require('../models/User');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { setAuthCookies, clearAuthCookies, cookieNames } = require('../utils/cookies');

function safeUser(u) {
  return { id: u._id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt };
}

async function register(req, res) {
  const { name, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'email and password required' });

  const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (exists) return res.status(409).json({ message: 'Email already registered' });

  const passwordHash = await User.hashPassword(String(password));
  const user = await User.create({
    name: name || '',
    email: String(email).toLowerCase().trim(),
    passwordHash,
  });

  const accessToken = signAccessToken({ userId: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken({ userId: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion });

  setAuthCookies(res, { accessToken, refreshToken });
  return res.json({ user: safeUser(user) });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'email and password required' });

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await user.comparePassword(String(password));
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const accessToken = signAccessToken({ userId: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken({ userId: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion });

  setAuthCookies(res, { accessToken, refreshToken });
  return res.json({ user: safeUser(user) });
}

async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ message: 'Not authenticated' });
  return res.json({ user: safeUser(user) });
}

async function logout(req, res) {
  // OPTIONAL: bump tokenVersion to invalidate existing refresh tokens
  try {
    const names = cookieNames();
    const rt = req.cookies?.[names.rt];
    if (rt) {
      const payload = verifyRefreshToken(rt);
      await User.updateOne({ _id: payload.sub }, { `$inc: { tokenVersion: 1 } });
    }
  } catch {}
  clearAuthCookies(res);
  return res.json({ ok: true });
}

async function refresh(req, res) {
  const names = cookieNames();
  const rt = req.cookies?.[names.rt];
  if (!rt) return res.status(401).json({ message: 'Missing refresh cookie' });

  let payload;
  try {
    payload = verifyRefreshToken(rt);
  } catch {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Invalid refresh token' });
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Invalid refresh token' });
  }

  // Rotation check:
  if (typeof payload.tv !== 'number' || payload.tv !== user.tokenVersion) {
    // token reuse / stale refresh: invalidate all
    await User.updateOne({ _id: user._id }, { `$inc: { tokenVersion: 1 } });
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Refresh expired. Please login again.' });
  }

  const accessToken = signAccessToken({ userId: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken({ userId: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion });

  setAuthCookies(res, { accessToken, refreshToken });
  return res.json({ ok: true });
}

module.exports = { register, login, me, logout, refresh };
'@

# ---- Auth routes
Write-File "routes\authRoutes.js" @"
const router = require('express').Router();
const { register, login, me, logout, refresh } = require('../controllers/authController');
const { requireAuth } = require('../middleware/requireAuth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/logout', logout);
router.post('/refresh', refresh);

module.exports = router;
"@

# ---- Protected sample routes
Write-File "routes\courseRoutes.js" @"
const router = require('express').Router();
const { requireAuth } = require('../middleware/requireAuth');

// Example: swap with your real DB logic
router.get('/', requireAuth, async (req, res) => {
  return res.json([
    { id: 'c1', title: 'Course One', description: 'Starter course', status: 'active', price: 0 },
    { id: 'c2', title: 'Course Two', description: 'Advanced course', status: 'active', price: 49 },
  ]);
});

router.get('/:id', requireAuth, async (req, res) => {
  return res.json({ id: req.params.id, title: 'Course ' + req.params.id, description: 'Course detail' });
});

module.exports = router;
"@

Write-File "routes\quizRoutes.js" @"
const router = require('express').Router();
const { requireAuth } = require('../middleware/requireAuth');

// Example quiz payload shape compatible with the frontend QuizPlayer
router.get('/', requireAuth, async (req, res) => {
  return res.json([
    { id: 'q1', title: 'Quiz One', courseId: 'c1' },
    { id: 'q2', title: 'Quiz Two', courseId: 'c2' },
  ]);
});

router.get('/:id', requireAuth, async (req, res) => {
  return res.json({
    id: req.params.id,
    title: 'Quiz ' + req.params.id,
    items: [
      { type: 'mc', prompt: '2+2?', choices: ['3', '4', '5'] },
      { type: 'text', prompt: 'Name one benefit of microlearning.' },
    ],
  });
});

// Canonical submit
router.post('/submit', requireAuth, async (req, res) => {
  const { quizId, answers } = req.body || {};
  return res.json({ ok: true, quizId, received: answers?.length || 0, score: 100 });
});

// Fallback submit by id
router.post('/:id/submit', requireAuth, async (req, res) => {
  const { answers } = req.body || {};
  return res.json({ ok: true, quizId: req.params.id, received: answers?.length || 0, score: 100 });
});

module.exports = router;
"@

# ---- server.js (the wiring that matters)
Write-File "server.js" @"
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');

const { connectDB } = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const quizRoutes = require('./routes/quizRoutes');

const app = express();

// ---- trust proxy (important for Secure cookies behind reverse proxies)
const trustProxy = String(process.env.TRUST_PROXY || '0') === '1';
if (trustProxy) app.set('trust proxy', 1);

// ---- Security headers
app.use(helmet());

// ---- Logging
app.use(morgan('dev'));

// ---- Parse JSON + cookies
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ---- CORS: MUST include credentials so cookies flow
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
}));

// ---- Health
app.get('/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

// ---- Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes);

// ---- 404
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// ---- Error handler
app.use((err, req, res, next) => {
  console.error('❌', err);
  res.status(500).json({ message: 'Server error' });
});

async function start() {
  const port = parseInt(process.env.PORT || '11001', 10);
  await connectDB(process.env.MONGO_URI);
  app.listen(port, () => console.log(\`✅ API running on http://localhost:\${port}\`));
}

start().catch((e) => {
  console.error('❌ Boot failed', e);
  process.exit(1);
});
"@

# ---- package.json (only create if missing)
if (-not (Test-Path (Join-Path $ROOT "package.json"))) {
  Write-File "package.json" @"
{
  "name": "microcourse-backend",
  "version": "1.0.0",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "dev": "node server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.6.3",
    "morgan": "^1.10.0"
  }
}
"@
}

Write-Host "`n✅ Backend cookie-auth layer installed." -ForegroundColor Green
Write-Host "NEXT:" -ForegroundColor Yellow
Write-Host "1) copy .env.example -> .env and fill values" -ForegroundColor Yellow
Write-Host "2) npm i" -ForegroundColor Yellow
Write-Host "3) npm run dev" -ForegroundColor Yellow




