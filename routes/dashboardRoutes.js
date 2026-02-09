const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

router.get("/", requireAuth, async (req, res) => {
  return res.json({
    ok: true,
    dashboard: {
      user: {
        id: req.user?.id,
        email: req.user?.email,
        role: req.user?.role,
        iat: req.user?.iat,
        exp: req.user?.exp,
      },
      message: "Dashboard online",
    },
  });
});

router.get("/student", requireAuth, requireRole("student"), async (req, res) => {
  return res.json({
    ok: true,
    view: "student",
    user: { id: req.user.id, email: req.user.email, role: req.user.role },
    message: "Student dashboard online",
  });
});

router.get("/instructor", requireAuth, requireRole("instructor", "admin"), async (req, res) => {
  return res.json({
    ok: true,
    view: "instructor",
    user: { id: req.user.id, email: req.user.email, role: req.user.role },
    message: "Instructor dashboard online",
  });
});

router.get("/admin", requireAuth, requireRole("admin"), async (req, res) => {
  return res.json({
    ok: true,
    view: "admin",
    user: { id: req.user.id, email: req.user.email, role: req.user.role },
    message: "Admin dashboard online",
  });
});

module.exports = router;