function notImplemented(action) {
  return (req, res) => res.status(501).json({ ok: false, error: "NOT_IMPLEMENTED", action });
}

module.exports = {
  ping: (req, res) => res.json({ ok: true, route: "badges" }),
  list: notImplemented("list"),
  getById: notImplemented("getById"),
  create: notImplemented("create"),
  update: notImplemented("update"),
  remove: notImplemented("remove")
};
