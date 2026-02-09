const mongoose = require("mongoose");

/**
 * Single source of truth for Mongo connection.
 * server.js must never call mongoose.connect directly.
 */
async function connectDB(mongoUri) {
  const uri = mongoUri || process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is missing. Set it in .env");
  }

  // Avoid duplicate connections in dev/test reruns
  if (mongoose.connection?.readyState === 1) return mongoose.connection;

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: true,
  });

  return mongoose.connection;
}

module.exports = { connectDB };