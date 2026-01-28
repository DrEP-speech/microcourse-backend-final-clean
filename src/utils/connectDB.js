const mongoose = require("mongoose");

let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri || uri.trim() === "" || uri.includes("CLUSTER.mongodb.net") || uri.includes("<") || uri.includes(">")) {
    throw new Error("MONGO_URI missing or placeholder. Set it correctly in .env (remove < >, replace placeholders).");
  }

  if (isConnected) return mongoose.connection;

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  });

  isConnected = true;
  return mongoose.connection;
}

module.exports = connectDB;