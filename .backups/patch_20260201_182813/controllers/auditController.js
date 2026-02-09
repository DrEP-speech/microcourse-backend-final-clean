const AuditLog = require("../models/AuditLog");

exports.listFlagged = async (req, res) => {
  try {
    const flagged = await AuditLog.find({ isFlagged: true, resolvedAt: null })
      .sort({ createdAt: -1 })
      .limit(500);

    return res.json({ ok: true, flagged });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "listFlagged failed", detail: err.message });
  }
};

exports.resolveFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await AuditLog.findByIdAndUpdate(
      id,
      { $set: { resolvedAt: new Date(), isFlagged: false } },
      { new: true }
    );

    if (!log) return res.status(404).json({ ok: false, error: "Audit log not found" });
    return res.json({ ok: true, log });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "resolveFlag failed", detail: err.message });
  }
};

exports.exportFlaggedCsv = async (req, res) => {
  try {
    const rows = await AuditLog.find({ isFlagged: true, resolvedAt: null }).sort({ createdAt: -1 }).limit(500);

    const header = "id,createdAt,kind,entityType,entityId,message\n";
    const body = rows.map(r => {
      const safeMsg = String(r.message || "").replace(/"/g, '""');
      return `"${r._id}","${r.createdAt.toISOString()}","${r.kind}","${r.entityType}","${r.entityId}","${safeMsg}"`;
    }).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=flagged-audit.csv");
    return res.status(200).send(header + body + "\n");
  } catch (err) {
    return res.status(500).json({ ok: false, error: "exportFlaggedCsv failed", detail: err.message });
  }
};