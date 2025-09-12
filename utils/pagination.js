// utils/pagination.js
export function parsePaging(req, { defaultLimit = 10, maxLimit = 50 } = {}) {
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const rawPage  = Number.parseInt(req.query.page, 10);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, maxLimit)) : defaultLimit;
  const page  = Number.isFinite(rawPage)  ? Math.max(1, rawPage) : 1;
  const skip  = (page - 1) * limit;
  return { limit, page, skip };
}

export function buildPageMeta({ total, page, limit }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page, limit, total, totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null,
  };
}

// escape text for use in RegExp
export function escapeRegex(s = '') {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
