/**
 * Cross-platform smoke test for MicroCourse backend.
 * Runs on Windows + Linux (Render), no PowerShell dependency.
 *
 * Env:
 *  - BASE_URL (default http://localhost:4000)
 *  - SMOKE_EMAIL / SMOKE_PASSWORD (optional; enables auth smoke checks)
 */

const base = process.env.BASE_URL || "http://localhost:4000";

async function hit(path, options = {}) {
  const res = await fetch(base + path, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { res, text, json };
}

function fail(msg) {
  console.error("SMOKE FAIL ❌");
  console.error(msg);
  process.exit(1);
}

(async () => {
  console.log("=== MicroCourse Backend Smoke Test ===");
  console.log("BASE_URL:", base);

  // 1) Health
  {
    const { res, json, text } = await hit("/api/health");
    if (!res.ok) return fail(`/api/health -> ${res.status} ${text}`);
    console.log("PASS /api/health");
  }

  // 2) Courses ping
  {
    const { res, json, text } = await hit("/api/courses/ping");
    if (!res.ok) return fail(`/api/courses/ping -> ${res.status} ${text}`);
    console.log("PASS /api/courses/ping");
  }

  // 3) Courses list
  {
    const { res, json, text } = await hit("/api/courses");
    if (!res.ok) return fail(`/api/courses -> ${res.status} ${text}`);
    if (!json || json.ok !== true || !Array.isArray(json.courses)) {
      return fail(`/api/courses returned unexpected shape: ${text}`);
    }
    console.log(`PASS /api/courses (count=${json.courses.length})`);
  }

  const email = process.env.SMOKE_EMAIL;
  const pass  = process.env.SMOKE_PASSWORD;

  if (email && pass) {
    console.log("Auth smoke: ENABLED");

    // 4) Bad login should fail
    {
      const { res } = await hit("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nope@example.com", password: "wrong" })
      });
      if (res.ok) return fail("Bad login unexpectedly succeeded");
      console.log("PASS bad login fails");
    }

    // 5) Good login should succeed
    let token = null;
    {
      const { res, json, text } = await hit("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass })
      });
      if (!res.ok) return fail(`/api/auth/login seed -> ${res.status} ${text}`);
      token = json && (json.token || (json.data && json.data.token));
      if (!token) return fail(`Login succeeded but no token returned. Body: ${text}`);
      console.log("PASS seeded login returns token");
    }

    // 6) /me without token should fail
    {
      const { res } = await hit("/api/auth/me");
      if (res.ok) return fail("/api/auth/me succeeded without token");
      console.log("PASS /api/auth/me requires token");
    }

    // 7) /me with token should succeed
    {
      const { res, text } = await hit("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return fail(`/api/auth/me with token -> ${res.status} ${text}`);
      console.log("PASS /api/auth/me with token");
    }
  } else {
    console.log("Auth smoke: SKIPPED (set SMOKE_EMAIL + SMOKE_PASSWORD to enable)");
  }

  console.log("SMOKE PASS ✅");
  process.exit(0);
})().catch((e) => fail(e && e.stack ? e.stack : String(e)));
