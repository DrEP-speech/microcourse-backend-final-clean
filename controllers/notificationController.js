'use strict';

function notImplemented(name) {
  return async (req, res) => {
    return res.status(501).json({
      ok: false,
      error: "NOT_IMPLEMENTED",
      handler: name,
      method: req.method,
      path: req.originalUrl
    });
  };
}
const Notification = require("../models/Notification");
const { HttpError } = require("../utils/httpError");

async function listMyNotifications(req, res, next) {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ ok: true, notifications });
  } catch (e) {
    next(e);
  }
}

async function markRead(req, res, next) {
  try {
    const n = await Notification.findById(req.params.id);
    if (!n) throw new HttpError(404, "Notification not found");
    if (n.userId.toString() !== req.user._id.toString()) throw new HttpError(403, "Forbidden");
    n.read = true;
    await n.save();
    res.json({ ok: true, notification: n });
  } catch (e) {
    next(e);
  }
}

module.exports = { listMyNotifications, markRead,
  listMyNotifications: notImplemented("listMyNotifications"),
  markRead: notImplemented("markRead"),
 };
