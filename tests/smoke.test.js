const request = require("supertest");
const base = process.env.BASE_URL || "http://localhost:10000";

describe("health + seed", () => {
  it("GET /api/healthz -> ok", async () => {
    const res = await request(base).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ok", true);
  });

  it("GET /api/seed/status?detail=1 -> has counts", async () => {
    const res = await request(base).get("/api/seed/status?detail=1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("counts");
  });
});
