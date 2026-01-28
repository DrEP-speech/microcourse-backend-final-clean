module.exports = {
  apps: [
    {
      name: "microcourse-api",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        PORT: 11001
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 11001
      }
    }
  ]
};
