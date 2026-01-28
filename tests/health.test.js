const request = require("supertest");

describe("Health endpoint", () => {
  it("GET /api/health returns ok:true", async () => {
    const base = process.env.TEST_BASE_URL || "http://localhost:4000";
    const res = await request(base).get("/api/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
