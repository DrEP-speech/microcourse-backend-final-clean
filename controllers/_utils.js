// controllers/_utils.js
import mongoose from 'mongoose';

export const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const parsePagination = (req) => {
  const page = Math.max(parseInt(req.query.page ?? '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit ?? '20', 10), 1), 100);
  const skip = (page - 1) * limit;
  const sort = req.query.sort ?? '-createdAt';
  return { page, limit, skip, sort };
};

export const requireFields = (obj, fields) => {
  const missing = fields.filter((f) => obj[f] == null || obj[f] === '');
  if (missing.length) {
    const err = new Error(`Missing required fields: ${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }
};

export const ok = (res, data = {}, meta = undefined) =>
  res.status(200).json({ success: true, data, ...(meta ? { meta } : {}) });

export const created = (res, data = {}) =>
  res.status(201).json({ success: true, data });

export const fail = (res, err, fallback = 'Server Error') =>
  res.status(err?.status || 500).json({ success: false, message: err?.message || fallback });
