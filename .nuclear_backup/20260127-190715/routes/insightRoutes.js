const router = require("express").Router();
const requireAuth = require("../middleware/requireAuth");

router.use(requireAuth);

/**
 * GET /api/insights/latest?userEmail=student1@demo.local
 */
router.get("/latest", async (req, res) => {
  try {
    return res.json({ ok: true, insight: null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Failed to load insight" });
  }
});

module.exports = router;
