const buckets = new Map();

// Simple sliding window: max N per windowMs per key
function rateLimit({ windowMs, max, keyFn }) {
  return (req, res, next) => {
    const key = (keyFn ? keyFn(req) : null) || req.ip || "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    let arr = buckets.get(key);
    if (!arr) arr = [];
    // keep only timestamps within window
    arr = arr.filter((t) => t > windowStart);

    if (arr.length >= max) {
      const retryAfterSec = Math.ceil((arr[0] + windowMs - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(1, retryAfterSec)));
      return res.status(429).json({ ok: false, error: "Rate limit exceeded" });
    }

    arr.push(now);
    buckets.set(key, arr);
    next();
  };
}

module.exports = { rateLimit };
