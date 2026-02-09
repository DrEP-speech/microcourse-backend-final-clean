async function getDashboard(req, res) {
  // Placeholder: stable endpoint to avoid server crash.
  return res.json({ ok: true, dashboard: { status: "online" } });
}

module.exports = { getDashboard,
  getDashboard: notImplemented("getDashboard"),
 };