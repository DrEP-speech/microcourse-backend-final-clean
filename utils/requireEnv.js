export function requireEnv(name, fallback) {
  const val = process.env[name];
  if (val != null && String(val).length) return val;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${name}`);
}