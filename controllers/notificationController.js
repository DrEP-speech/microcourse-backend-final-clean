// controllers/notificationController.js
// Stubbed handlers — replace with real DB logic when ready

export async function list(req, res) {
  // Return an empty list for now (scoped to user if you prefer)
  return res.json({ success: true, items: [] });
}

export async function create(req, res) {
  // Accept { title, body } for now
  const { title = '', body = '' } = req.body || {};
  return res.status(201).json({ success: true, notification: { id: 'stub', title, body, read: false } });
}

export async function markRead(req, res) {
  const { id } = req.params;
  return res.json({ success: true, id, read: true });
}

export async function remove(req, res) {
  const { id } = req.params;
  return res.json({ success: true, id, deleted: true });
}
