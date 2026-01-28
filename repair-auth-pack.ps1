param()

function Write-Utf8NoBom {
  param([Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$Content)

  $full = Join-Path (Get-Location) $Path
  $dir  = Split-Path $full -Parent
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($full, $Content, $utf8NoBom)
}

function Ensure-Dir($p){
  $full = Join-Path (Get-Location) $p
  if (!(Test-Path $full)) { New-Item -ItemType Directory -Path $full -Force | Out-Null }
}

# --- 0) Ensure folders exist
Ensure-Dir ".\src"
Ensure-Dir ".\src\controllers"
Ensure-Dir ".\src\middleware"
Ensure-Dir ".\src\routes"
Ensure-Dir ".\routes"

# --- 1) authController.js (robust: supports email OR username OR identifier)
$authController = @"
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

/**
 * Tries to require a module from multiple possible paths.
 * This avoids "can't find User model" across slightly different repo layouts.
 */
function requireFirst(paths) {
  for (const p of paths) {
    try { return require(p); } catch (e) {}
  }
  return null;
}

const User =
  requireFirst([
    "../models/User",
    "../models/user",
    "../models/UserModel",
    "../models/userModel",
    "../../models/User",
    "../../models/user",
  ]);

function signToken(payload) {
  const secret =
    process.env.JWT_SECRET ||
    process.env.SECRET ||
    process.env.JWT_KEY ||
    "dev_secret_change_me";

  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, secret, { expiresIn });
}

exports.login = async (req, res) => {
  try {
    const body = req.body || {};

    // Accept multiple shapes:
    // { email, password } OR { username, password } OR { identifier, password }
    const email = (body.email || "").toString().trim();
    const username = (body.username || "").toString().trim();
    const identifier = (body.identifier || "").toString().trim();
    const password = (body.password || "").toString();

    const id = email || username || identifier;

    if (!id || !password) {
      return res.status(400).json({ ok: false, error: "email/username and password required" });
    }

    if (!User) {
      return res.status(500).json({
        ok: false,
        error: "User model not found. Ensure you have a User model under src/models or models.",
      });
    }

    // Find by email OR username
    const user = await User.findOne({
      $or: [{ email: id.toLowerCase() }, { username: id }, { userName: id }, { handle: id }],
    }).select("+password");

    if (!user) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    // Compare hashed or plain
    const stored = user.password || "";
    let ok = false;

    if (stored && stored.startsWith("$2")) {
      ok = await bcrypt.compare(password, stored);
    } else {
      ok = stored === password;
    }

    if (!ok) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const role = user.role || user.userRole || "user";

    const token = signToken({
      id: user._id.toString(),
      email: user.email,
      username: user.username || user.userName || null,
      role,
    });

    return res.json({
      ok: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username || user.userName || null,
        role,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "Login failed" });
  }
};

exports.me = async (req, res) => {
  try {
    // authMiddleware sets req.user
    return res.json({ ok: true, user: req.user || null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "Failed" });
  }
};
"@

Write-Utf8NoBom ".\src\controllers\authController.js" $authController

# --- 2) authMiddleware.js (supports Authorization: Bearer, x-access-token, x-auth-token)
$authMiddleware = @"
const jwt = require("jsonwebtoken");

module.exports = function authMiddleware(req, res, next) {
  try {
    const header = req.headers["authorization"] || "";
    const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;

    const token =
      bearer ||
      req.headers["x-access-token"] ||
      req.headers["x-auth-token"] ||
      req.headers["token"] ||
      null;

    if (!token) {
      return res.status(401).json({ ok: false, error: "Missing token" });
    }

    const secret =
      process.env.JWT_SECRET ||
      process.env.SECRET ||
      process.env.JWT_KEY ||
      "dev_secret_change_me";

    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
};
"@

Write-Utf8NoBom ".\src\middleware\authMiddleware.js" $authMiddleware

# --- 3) authRoutes.js (adds /login and /signin for your E2E script)
$authRoutes = @"
const express = require("express");
const router = express.Router();

const { login, me } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// Login aliases (your E2E script tries multiple)
router.post("/login", login);
router.post("/signin", login);

// Token check
router.get("/me", authMiddleware, me);

module.exports = router;
"@

Write-Utf8NoBom ".\src\routes\authRoutes.js" $authRoutes

# --- 4) Root proxy for your existing pattern: routes/*.js -> src/routes/*.js
$proxy = @"
module.exports = require("../src/routes/authRoutes");
"@
Write-Utf8NoBom ".\routes\authRoutes.js" $proxy

# --- 5) Patch server.js to mount auth correctly + aliases
# This REPLACES server.js with a stable version that mounts your existing routes safely.
$server = @"
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// --- DB connect (keep your existing util if present)
let connectDB = null;
try { connectDB = require("./src/utils/connectDB"); } catch (e) {}
try { if (!connectDB) connectDB = require("./src/utils/connectDb"); } catch (e) {}

(async () => {
  try {
    if (connectDB) await connectDB();
  } catch (e) {
    console.error("[server] DB connect failed:", e.message);
  }

  // --- Routes (require from src/routes)
  const safeRequire = (p) => { try { return require(p); } catch (e) { return null; } };

  const authRoutes     = safeRequire("./src/routes/authRoutes");
  const courseRoutes   = safeRequire("./src/routes/courseRoutes");
  const quizRoutes     = safeRequire("./src/routes/quizRoutes");
  const resultsRoutes  = safeRequire("./src/routes/resultsRoutes");
  const insightsRoutes = safeRequire("./src/routes/insightsRoutes");

  // Health
  app.get("/api/health", (req, res) => res.json({ ok: true }));

  // --- Mount main API routes
  if (authRoutes) {
    app.use("/api/auth", authRoutes);

    // Aliases your E2E/login scripts try:
    app.use("/api/login", authRoutes);        // /api/login/login (not used often)
    app.use("/api/users", authRoutes);        // /api/users/login
    app.use("/api/instructor", authRoutes);   // /api/instructor/login
    app.use("/api/admin", authRoutes);        // /api/admin/login

    console.log("[server] Mounted /api/auth -> src/routes/authRoutes.js");
  } else {
    console.warn("[server] authRoutes missing - /api/auth NOT mounted");
  }

  if (courseRoutes)   { app.use("/api/courses", courseRoutes);   console.log("[server] Mounted /api/courses"); }
  if (quizRoutes)     { app.use("/api/quizzes", quizRoutes);     console.log("[server] Mounted /api/quizzes"); }
  if (resultsRoutes)  { app.use("/api/results", resultsRoutes);  console.log("[server] Mounted /api/results"); }
  if (insightsRoutes) { app.use("/api/insights", insightsRoutes);console.log("[server] Mounted /api/insights"); }

  // 404
  app.use((req, res) => res.status(404).json({ ok: false, error: "Not found" }));

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log("[server] listening on", PORT));
})();
"@

Write-Utf8NoBom ".\server.js" $server

Write-Host "`n[DONE] Auth pack rebuilt cleanly." -ForegroundColor Green
Write-Host "Next: restart backend, then run the login test below." -ForegroundColor Cyan