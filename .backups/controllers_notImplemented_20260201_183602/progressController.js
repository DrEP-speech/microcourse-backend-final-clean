async function getProgress(req, res) {
  // Placeholder: stable endpoint to avoid server crash.
  // Implement your real progress logic later.
  return res.json({ ok: true, progress: { streak: 0, completed: 0 } });
}

module.exports = { getProgress,
  getProgress: notImplemented("getProgress"),
 };