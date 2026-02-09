exports.listPublic = async (req, res) => {
  return res.json({ ok: true, courses: [] });
};

exports.list = async (req, res) => {
  // Auth-only listing (placeholder)
  return res.json({ ok: true, courses: [] });
};