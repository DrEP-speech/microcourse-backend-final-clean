const mongoose = require("mongoose");

let conn = null;

async function connectDB(uri) {
  if (conn) return conn;
  if (!uri) throw new Error("MongoDB URI is missing. Set MONGO_URI.");
  try {
    conn = await mongoose.connect(uri);
    console.log("✅ MongoDB connected");
    return conn;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    throw err;
  }
}

module.exports = connectDB;
