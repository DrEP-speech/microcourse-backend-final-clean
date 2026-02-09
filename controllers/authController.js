const jwt = require("jsonwebtoken");

let bcrypt;
try { bcrypt = require("bcryptjs"); } catch (e) { bcrypt = require("bcrypt"); }

const User = require("../models/User");

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  if (!secret) throw new Error("JWT_SECRET_MISSING");
  return jwt.sign(
    { id: String(user._id), email: user.email, role: user.role },
    secret,
    { expiresIn }
  );
}

function safeUser(u) {
  return { id: String(u._id), email: u.email, role: u.role };
}

exports.register = async (req, res) => {
  try {
    const { email, password, role } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "EMAIL_AND_PASSWORD_REQUIRED" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const newRole = role ? String(role).trim().toLowerCase() : "student";

    // allow only known roles (adjust if your app supports more)
    const allowed = new Set(["student", "instructor", "admin"]);
    if (!allowed.has(newRole)) {
      return res.status(400).json({ ok: false, error: "INVALID_ROLE" });
    }

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({ ok: false, error: "EMAIL_ALREADY_EXISTS" });
    }

    const hash = await bcrypt.hash(String(password), 10);

    const user = await User.create({
      email: normalizedEmail,
      passwordHash: hash,
      role: newRole,
    });

    const token = signToken(user);

    // Optional cookie for browser flows (E2E uses Bearer)
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // set true behind https
    });

    return res.status(201).json({ ok: true, user: safeUser(user), token });
  } catch (err) {
    // Translate common Mongo errors into non-500 responses
    const msg = err && err.message ? err.message : "REGISTER_FAILED";
    if (err && err.code === 11000) {
      return res.status(409).json({ ok: false, error: "EMAIL_ALREADY_EXISTS" });
    }
    if (msg.includes("validation") || msg.includes("VALIDATION")) {
      return res.status(400).json({ ok: false, error: "VALIDATION_ERROR" });
    }
    return res.status(500).json({ ok: false, error: "REGISTER_FAILED", detail: msg });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "EMAIL_AND_PASSWORD_REQUIRED" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });

    const ok = await bcrypt.compare(String(password), user.passwordHash || "");
    if (!ok) return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });

    const token = signToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });

    return res.json({ ok: true, user: safeUser(user), token });
  } catch (err) {
    const msg = err && err.message ? err.message : "LOGIN_FAILED";
    return res.status(500).json({ ok: false, error: "LOGIN_FAILED", detail: msg });
  }
};

exports.me = async (req, res) => {
  try {
    // req.user comes from requireAuth
    return res.json({ ok: true, user: req.user });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "ME_FAILED" });
  }
};