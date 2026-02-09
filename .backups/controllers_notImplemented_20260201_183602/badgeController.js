const Badge = require("../models/Badge");
const User = require("../models/User");
const { HttpError } = require("../utils/httpError");

async function listBadges(req, res, next) {
  try {
    const badges = await Badge.find({}).sort({ createdAt: -1 });
    res.json({ ok: true, badges });
  } catch (e) {
    next(e);
  }
}

async function myBadges(req, res, next) {
  try {
    const user = await User.findById(req.user._id).populate("badges");
    res.json({ ok: true, badges: user?.badges || [] });
  } catch (e) {
    next(e);
  }
}

async function awardBadge(req, res, next) {
  try {
    if (!["admin", "instructor"].includes(req.user.role)) throw new HttpError(403, "Forbidden");

    const { userId, code } = req.body || {};
    if (!userId || !code) throw new HttpError(400, "userId and code required");

    const badge = await Badge.findOne({ code });
    if (!badge) throw new HttpError(404, "Badge not found");

    const user = await User.findById(userId);
    if (!user) throw new HttpError(404, "User not found");

    const has = (user.badges || []).some((b) => b.toString() === badge._id.toString());
    if (!has) {
      user.badges.push(badge._id);
      await user.save();
    }

    res.json({ ok: true, awarded: true, badge });
  } catch (e) {
    next(e);
  }
}

module.exports = { listBadges, myBadges, awardBadge,
  awardBadge: notImplemented("awardBadge"),
  listBadges: notImplemented("listBadges"),
  myBadges: notImplemented("myBadges"),
 };
