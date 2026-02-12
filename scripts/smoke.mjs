const base = process.env.BASE_URL || "http://127.0.0.1:4000";

async function get(path) {
  const r = await fetch(base + path);
  const text = await r.text();
  return { status: r.status, text };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const h = await get("/health");
  assert(h.status === 200, `/health expected 200 got ${h.status}`);

  const v = await get("/version");
  assert(v.status === 200, `/version expected 200 got ${v.status}`);

  const pub = await get("/api/courses/public");
  assert(pub.status === 200, `/api/courses/public expected 200 got ${pub.status}`);

  // protected should block
  const priv = await get("/api/courses");
  assert([401,403].includes(priv.status), `/api/courses expected 401/403 got ${priv.status}`);

  console.log("SMOKE OK");
})().catch((e) => {
  console.error("SMOKE FAIL:", e.message);
  process.exit(1);
});
