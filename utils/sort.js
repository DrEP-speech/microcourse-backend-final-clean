// utils/sort.js
// Usage: parseSort(req.query.sort, ['createdAt','title','published'], { createdAt: -1 })
export function parseSort(sortParam, allow = [], fallback = { createdAt: -1 }) {
  if (!sortParam) return fallback;
  const out = {};
  const parts = String(sortParam).split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const [rawKey, rawDir] = part.split(':');
    const key = rawKey?.trim();
    if (!key || !allow.includes(key)) continue;
    const dir = (rawDir || 'asc').toLowerCase();
    out[key] = dir === 'desc' || dir === '-' ? -1 : 1;
  }
  return Object.keys(out).length ? out : fallback;
}
