module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  clearMocks: true,
  collectCoverageFrom: ["src/**/*.js", "server.js"],
  coverageDirectory: "coverage"
};
