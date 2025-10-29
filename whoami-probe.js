"use strict";
const express = require("express");
const jwt = require("jsonwebtoken");
let User;
try { User = require("./models/User"); } catch (_) { User = null; }

const router = express.Router();

function getBearer(req) {
  const h = req.headers["authorization"] || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

router.get("/whoami", async (req, res) => {
  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ success:false, message:"Missing Bearer token" });
    const secret = process.env.JWT_SECRET || "dev-secret";
    const payload = jwt.verify(token, secret);

    let userDoc = null;
    if (User && payload && (payload.id || payload._id)) {
      userDoc = await User.findById(payload.id || payload._id).lean().select("email role");
    }
    return res.json({ success:true, user: userDoc || payload });
  } catch (err) {
    return res.status(401).json({
      success:false,
      message:"Invalid token",
      error: process.env.NODE_ENV === "development" ? String(err) : undefined
    });
  }
});

module.exports = router;
