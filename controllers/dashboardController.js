/**
 * Dashboard Controller
 * Keep this controller small + stable (investor-friendly reliability).
 */

async function getDashboard(req, res) {
  return res.json({
    ok: true,
    message: "Dashboard ready",
    user: req.user || null
  });
}

module.exports = { getDashboard };
