const nodemailer = require("nodemailer");
const EmailLog = require("../models/EmailLog");
const { env } = require("../config/env");
const { HttpError } = require("../utils/httpError");

function canSendSmtp() {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

async function sendEmail(req, res, next) {
  try {
    const { to, subject, text, html, type, meta } = req.body || {};
    if (!to || !subject) throw new HttpError(400, "to and subject are required");

    const log = await EmailLog.create({
      type: type || "generic",
      to,
      subject,
      status: "queued",
      meta: meta || {}
    });

    if (!canSendSmtp()) {
      log.status = "failed";
      log.error = "SMTP not configured (set SMTP_HOST/SMTP_USER/SMTP_PASS)";
      await log.save();
      return res.status(202).json({ ok: true, queued: true, sent: false, logId: log._id, note: log.error });
    }

    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
    });

    await transport.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      text: text || "",
      html: html || ""
    });

    log.status = "sent";
    await log.save();

    res.json({ ok: true, sent: true, logId: log._id });
  } catch (e) {
    next(e);
  }
}

async function listEmailLogs(req, res, next) {
  try {
    if (!["admin", "instructor"].includes(req.user.role)) throw new HttpError(403, "Forbidden");
    const type = req.query.type ? String(req.query.type) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const filter = {};
    if (type) filter.type = type;
    if (to) filter.to = to;

    const page = Math.max(Number(req.query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize || 25), 1), 200);

    const total = await EmailLog.countDocuments(filter);
    const logs = await EmailLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    res.json({ ok: true, page, pageSize, total, logs });
  } catch (e) {
    next(e);
  }
}

module.exports = { sendEmail, listEmailLogs };
